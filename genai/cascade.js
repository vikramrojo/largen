/* largen — resolve which declaration wins, without a browser.
 *
 * WHY THIS EXISTS
 *
 * A migration onto largen kept a hand-built iframe + getComputedStyle harness
 * and reached for it about twenty times. Sorted by the question actually being
 * asked, two thirds of those were not about rendering at all — they were "which
 * declaration wins for this property on this element, and why". A browser was
 * used because it was the only oracle available, not because the question needed
 * one. `--weight: 900` computing as `300`, a badge sitting two pixels low, links
 * surviving `--fg: inherit` only by accident: every one is answerable from
 * stylesheets, layer order and an ancestor chain.
 *
 * THE FOUR-ANSWER RULE — the most important thing in this file
 *
 * An element is described here as a *linear* ancestor chain. A chain has no
 * siblings, no child indices and no interaction state, so a whole class of
 * selector cannot be evaluated against it: `:hover`, `:last-child`, `:nth-*`,
 * `+`, `~`. That is not a corner case — largen's own stylesheets contain 29 such
 * occurrences, including `tbody:last-of-type tr:last-child`, which is the rule
 * behind one of the four bugs above.
 *
 * So a rule has four outcomes, not three: it wins, it loses, it does not match,
 * or it is UNDECIDABLE from this chain. The fourth must never collapse into the
 * third. This tool is consulted precisely when the caller's own model of the
 * cascade has already failed, which means they have no independent check on its
 * answer; a resolver that quietly discards what it cannot evaluate reports an
 * absence, and an absence reads as "there is no rule here". Being wrong and
 * saying so is usable. Being wrong and confident is worse than being silent.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 *
 * No @media evaluation — conditions are reported, not decided. No calc()
 * reduction — expressions come back as written. No inheritance walk — a
 * property that does not inherit and is unset here is reported as exactly that,
 * which is itself an answer the reporter needed twice.
 */

/* --- comments ------------------------------------------------------------- */

/* Comments and strings have to be recognised by one pass in source order,
   because each can contain the other's delimiters. Scanning strings first fails
   immediately on this codebase: largen's comments are English prose full of
   apostrophes, and a string scanner reads the one in "component's" as an opening
   quote. Replacing with spaces rather than deleting keeps every byte offset, so
   reported positions still point at the real source. */
export function maskComments(css) {
  let out = ''
  let i = 0
  while (i < css.length) {
    const ch = css[i]
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      const stop = end < 0 ? css.length : end + 2
      for (let k = i; k < stop; k++) out += css[k] === '\n' ? '\n' : ' '
      i = stop
      continue
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1
      while (j < css.length && css[j] !== ch) { if (css[j] === '\\') j++; j++ }
      out += css.slice(i, Math.min(j + 1, css.length))
      i = j + 1
      continue
    }
    out += ch
    i++
  }
  return out
}

/* --- parsing -------------------------------------------------------------- */

/* Blocks whose contents are not style rules and must not be read as such. */
const OPAQUE = /^@(keyframes|font-face|property|counter-style|font-feature-values|page|viewport)\b/

const lineAt = (text, index) => text.slice(0, index).split('\n').length

/**
 * Collect every style rule in a stylesheet, with the layer and conditions it
 * sits inside.
 *
 * largen uses no CSS nesting, and neither did the project this was built for, so
 * a style rule's block is declarations only. If that changes this is where it
 * changes.
 *
 * @param {string} css
 * @param {string} file
 * @param {{start?: number}} [counter] shared source-order counter across files
 * @returns {Array<object>} rules in source order
 */
export function parseStylesheet(css, file, counter = { n: 0 }) {
  const text = maskComments(String(css))
  const rules = []
  const stack = []            /* enclosing @layer / @media / @supports */
  let i = 0
  let mark = 0                /* start of the current prelude */

  const layerOf = () => stack.filter((s) => s.type === 'layer').map((s) => s.name).join('.') || null
  const condsOf = () => stack.filter((s) => s.type === 'cond').map((s) => s.text)

  const skipBlock = (from) => {
    let depth = 0
    for (let k = from; k < text.length; k++) {
      if (text[k] === '{') depth++
      else if (text[k] === '}') { depth--; if (depth === 0) return k + 1 }
    }
    return text.length
  }

  while (i < text.length) {
    const ch = text[i]

    if (ch === ';') {
      /* An at-statement: @import, @layer a, b; @charset. Layer *statements*
         establish order and are handled by layers.js; nothing here needs them. */
      mark = ++i
      continue
    }

    if (ch === '}') {
      stack.pop()
      mark = ++i
      continue
    }

    if (ch !== '{') { i++; continue }

    const prelude = text.slice(mark, i).trim()
    const preludeAt = mark + (text.slice(mark, i).length - text.slice(mark, i).trimStart().length)

    if (OPAQUE.test(prelude)) { i = skipBlock(i); mark = i; continue }

    if (prelude.startsWith('@')) {
      const layer = prelude.match(/^@layer\s+([\w-]+(?:\.[\w-]+)*)\s*$/)
      if (layer) {
        /* `@layer a.b { }` is one block naming a nested layer; record it as
           written so the dotted name survives to the caller. */
        stack.push({ type: 'layer', name: layer[1] })
      } else {
        stack.push({ type: 'cond', text: prelude })
      }
      mark = ++i
      continue
    }

    /* A style rule. */
    const end = skipBlock(i)
    const body = text.slice(i + 1, end - 1)
    const original = String(css).slice(i + 1, end - 1)
    rules.push({
      file,
      selector: prelude,
      line: lineAt(String(css), preludeAt),
      layer: layerOf(),
      conditions: condsOf(),
      order: counter.n++,
      declarations: parseDeclarations(body, original),
    })
    i = end
    mark = i
  }

  return rules
}

/** Split a declaration block. Values may contain nested parens and commas, so
 *  split on top-level semicolons only — `transition: a 1s, b 2s` is one. */
export function parseDeclarations(body, original = body) {
  const out = []
  let depth = 0
  let start = 0
  const push = (from, to) => {
    const raw = body.slice(from, to)
    if (!raw.trim()) return
    const colon = (() => {
      let d = 0
      for (let k = 0; k < raw.length; k++) {
        if (raw[k] === '(') d++
        else if (raw[k] === ')') d--
        else if (raw[k] === ':' && d === 0) return k
      }
      return -1
    })()
    if (colon < 0) return
    const prop = raw.slice(0, colon).trim()
    let value = original.slice(from + colon + 1, to).trim()
    let important = false
    const bang = value.match(/!\s*important\s*$/i)
    if (bang) { important = true; value = value.slice(0, bang.index).trim() }
    if (prop) out.push({ property: prop, value, important })
  }
  for (let k = 0; k < body.length; k++) {
    const c = body[k]
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === ';' && depth === 0) { push(start, k); start = k + 1 }
  }
  push(start, body.length)
  return out
}

/* --- selectors ------------------------------------------------------------ */

/* Everything a linear ancestor chain cannot decide. Grouped by what is missing,
   because the message a caller needs is "this depends on X, and a chain has no
   X" rather than "unsupported". */
const UNDECIDABLE_PSEUDO = {
  'hover': 'pointer state', 'focus': 'focus state', 'focus-visible': 'focus state',
  'focus-within': 'focus state', 'active': 'pointer state', 'visited': 'history',
  'target': 'the document URL', 'checked': 'form state', 'indeterminate': 'form state',
  'disabled': 'form state', 'enabled': 'form state', 'required': 'form state',
  'optional': 'form state', 'valid': 'form state', 'invalid': 'form state',
  'placeholder-shown': 'form state', 'default': 'form state', 'open': 'element state',
  'first-child': 'sibling position', 'last-child': 'sibling position',
  'only-child': 'sibling position', 'first-of-type': 'sibling position',
  'last-of-type': 'sibling position', 'only-of-type': 'sibling position',
  'nth-child': 'sibling position', 'nth-last-child': 'sibling position',
  'nth-of-type': 'sibling position', 'nth-last-of-type': 'sibling position',
  'empty': 'descendants', 'has': 'descendants', 'root': 'document position',
}

const UNDECIDABLE_COMBINATOR = { '+': 'an adjacent sibling', '~': 'a preceding sibling' }

/** Split on top-level commas — `:is(a, b)` must not be split. */
export function splitTopLevel(text, separator = ',') {
  const out = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (c === separator && depth === 0) { out.push(text.slice(start, i)); start = i + 1 }
  }
  out.push(text.slice(start))
  return out.map((s) => s.trim()).filter(Boolean)
}

/** Break a complex selector into compounds and the combinators between them. */
export function splitCombinators(selector) {
  const parts = []
  let depth = 0
  let buf = ''
  let i = 0
  const flush = () => { if (buf.trim()) parts.push({ type: 'compound', text: buf.trim() }); buf = '' }
  while (i < selector.length) {
    const c = selector[i]
    if (c === '(' || c === '[') depth++
    if (c === ')' || c === ']') depth--
    if (depth === 0 && (c === '>' || c === '+' || c === '~')) {
      flush(); parts.push({ type: 'combinator', text: c }); i++; continue
    }
    if (depth === 0 && /\s/.test(c)) {
      /* One or more spaces is a descendant combinator unless the next
         non-space is another combinator, which already consumed the gap. */
      let j = i
      while (j < selector.length && /\s/.test(selector[j])) j++
      if (j < selector.length && !'>+~'.includes(selector[j]) && buf.trim()) {
        flush(); parts.push({ type: 'combinator', text: ' ' })
      }
      i = j
      continue
    }
    buf += c
    i++
  }
  flush()
  return parts
}

/** Parse one compound selector into its pieces. */
export function parseCompound(text) {
  const out = { tag: null, id: null, classes: [], attrs: [], pseudos: [], universal: false }
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (c === '*') { out.universal = true; i++; continue }
    if (c === '.' || c === '#') {
      let j = i + 1
      while (j < text.length && /[\w-]/.test(text[j])) j++
      if (c === '.') out.classes.push(text.slice(i + 1, j))
      else out.id = text.slice(i + 1, j)
      i = j
      continue
    }
    if (c === '[') {
      let depth = 0
      let j = i
      for (; j < text.length; j++) {
        if (text[j] === '[') depth++
        else if (text[j] === ']') { depth--; if (!depth) break }
      }
      out.attrs.push(text.slice(i + 1, j))
      i = j + 1
      continue
    }
    if (c === ':') {
      const double = text[i + 1] === ':'
      let j = i + (double ? 2 : 1)
      while (j < text.length && /[\w-]/.test(text[j])) j++
      const name = text.slice(i + (double ? 2 : 1), j)
      let args = null
      if (text[j] === '(') {
        let depth = 0
        let k = j
        for (; k < text.length; k++) {
          if (text[k] === '(') depth++
          else if (text[k] === ')') { depth--; if (!depth) break }
        }
        args = text.slice(j + 1, k)
        j = k + 1
      }
      out.pseudos.push({ name, args, element: double })
      i = j
      continue
    }
    let j = i
    while (j < text.length && /[\w-]/.test(text[j])) j++
    if (j === i) { i++; continue }
    out.tag = text.slice(i, j).toLowerCase()
    i = j
  }
  return out
}

/* --- matching ------------------------------------------------------------- */

/** Parse `[a]`, `[a=b]`, `[a^="b" i]` into something comparable. */
function parseAttr(text) {
  const m = text.match(/^\s*([\w-]+)\s*(?:([~^$*|]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]*))\s*(i|s)?)?\s*$/i)
  if (!m) return null
  return { name: m[1], op: m[2] || null, value: m[3] ?? m[4] ?? m[5] ?? null, ci: (m[6] || '').toLowerCase() === 'i' }
}

function attrMatches(spec, node) {
  const attrs = node.attrs || {}
  const key = Object.keys(attrs).find((k) => k.toLowerCase() === spec.name.toLowerCase())
  if (key === undefined) return false
  if (!spec.op) return true
  let actual = String(attrs[key] ?? '')
  let want = String(spec.value ?? '')
  if (spec.ci) { actual = actual.toLowerCase(); want = want.toLowerCase() }
  switch (spec.op) {
    case '=': return actual === want
    case '~=': return actual.split(/\s+/).includes(want)
    case '^=': return want !== '' && actual.startsWith(want)
    case '$=': return want !== '' && actual.endsWith(want)
    case '*=': return want !== '' && actual.includes(want)
    case '|=': return actual === want || actual.startsWith(want + '-')
    default: return false
  }
}

/**
 * Match one compound selector against one node in the chain.
 *
 * Returns `true`, `false`, or an `{undecidable}` marker. The third is not a
 * failure mode of this function — it is a result, and the caller must keep it
 * distinct from `false` all the way out to the report.
 */
function matchCompound(compound, node) {
  const c = typeof compound === 'string' ? parseCompound(compound) : compound
  const undecidable = []

  if (c.tag && c.tag !== '*' && String(node.tag || '').toLowerCase() !== c.tag) return false
  if (c.id && node.id !== c.id) return false
  const classes = node.classes || []
  for (const cls of c.classes) if (!classes.includes(cls)) return false
  for (const a of c.attrs) {
    const spec = parseAttr(a)
    if (!spec) { undecidable.push({ construct: `[${a}]`, reason: 'attribute selector could not be parsed' }); continue }
    if (!attrMatches(spec, node)) return false
  }

  for (const p of c.pseudos) {
    if (p.element) continue /* ::before etc. — the subject is still this element */
    if (p.name === 'where' || p.name === 'is') {
      /* Matches if any argument matches. Undecidable only if nothing matched
         outright and something could not be decided. */
      let any = false
      const pending = []
      for (const arg of splitTopLevel(p.args || '')) {
        const r = matchComplexAgainstNode(arg, node)
        if (r === true) { any = true; break }
        if (r && r.undecidable) pending.push(...r.undecidable)
      }
      if (any) continue
      if (pending.length) { undecidable.push(...pending); continue }
      return false
    }
    if (p.name === 'not') {
      let any = false
      const pending = []
      for (const arg of splitTopLevel(p.args || '')) {
        const r = matchComplexAgainstNode(arg, node)
        if (r === true) { any = true; break }
        if (r && r.undecidable) pending.push(...r.undecidable)
      }
      if (any) return false
      if (pending.length) { undecidable.push(...pending); continue }
      continue
    }
    const why = UNDECIDABLE_PSEUDO[p.name]
    if (why) {
      undecidable.push({ construct: `:${p.name}${p.args ? `(${p.args})` : ''}`, reason: `depends on ${why}, which an ancestor chain does not carry` })
      continue
    }
    /* An unknown pseudo-class is not assumed to match. Guessing here is how a
       resolver becomes confidently wrong. */
    undecidable.push({ construct: `:${p.name}`, reason: 'unrecognised pseudo-class' })
  }

  return undecidable.length ? { undecidable } : true
}

/* A complex selector used *inside* :is()/:where()/:not() is evaluated against a
   single node only. Its own ancestor parts cannot be checked without the chain,
   so anything with a combinator is undecidable there rather than assumed. */
function matchComplexAgainstNode(selector, node) {
  const parts = splitCombinators(selector)
  if (parts.length === 1) return matchCompound(parts[0].text, node)
  return { undecidable: [{ construct: selector, reason: 'a combinator inside :is()/:where()/:not() needs the chain, not just this element' }] }
}

/**
 * Match a complex selector against an ancestor chain.
 *
 * @param {string} selector  one complex selector, no commas
 * @param {Array<{tag,id,classes,attrs}>} path  outermost first; the last is the subject
 * @returns {{matches: boolean, undecidable: object[]}}
 */
export function matchSelector(selector, path) {
  const parts = splitCombinators(selector)
  const undecidable = []

  /* Sibling combinators are undecidable before anything else is examined —
     the chain simply does not contain the information. */
  for (const p of parts) {
    if (p.type === 'combinator' && UNDECIDABLE_COMBINATOR[p.text]) {
      return {
        verdict: 'undecidable',
        matches: false,
        undecidable: [{ construct: p.text, reason: `needs ${UNDECIDABLE_COMBINATOR[p.text]}, and an ancestor chain has no siblings` }],
      }
    }
  }

  /* Walk right to left. `index` is the node the current compound must match;
     descendant combinators may skip ancestors, so try each and backtrack. */
  const compounds = parts.filter((p) => p.type === 'compound').map((p) => p.text)
  const combinators = parts.filter((p) => p.type === 'combinator').map((p) => p.text)

  const step = (ci, ni) => {
    if (ci < 0) return true
    if (ni < 0) return false
    const r = matchCompound(compounds[ci], path[ni])
    const here = r === true ? true : (r && r.undecidable ? r.undecidable : false)

    if (ci === compounds.length - 1) {
      /* The subject must be the element itself; no searching. */
      if (here === false) return false
      if (here !== true) undecidable.push(...here)
      return step(ci - 1, ni - 1)
    }

    const combinator = combinators[ci]
    if (combinator === '>') {
      if (here === false) return false
      if (here !== true) undecidable.push(...here)
      return step(ci - 1, ni - 1)
    }
    /* Descendant: this compound may match any ancestor. */
    for (let k = ni; k >= 0; k--) {
      const rk = matchCompound(compounds[ci], path[k])
      if (rk === true) { if (step(ci - 1, k - 1)) return true }
      else if (rk && rk.undecidable) {
        undecidable.push(...rk.undecidable)
        if (step(ci - 1, k - 1)) return true
      }
    }
    return false
  }

  const matched = step(compounds.length - 1, path.length - 1)

  /* Three-valued, and named so a caller cannot read it as two.
     `matched && undecidable.length` means the decidable parts of the selector fit
     and something else could not be evaluated — that is UNDECIDABLE, not a match.
     Returning `matches: true` here with the doubt tucked into a second field is
     precisely how the doubt gets dropped: every caller has to remember to check
     it, and one day one of them will not. */
  const verdict = !matched ? (undecidable.length ? 'undecidable' : 'no-match')
    : (undecidable.length ? 'undecidable' : 'match')

  return { verdict, matches: verdict === 'match', undecidable }
}

/* --- specificity ---------------------------------------------------------- */

/** [id, class/attr/pseudo-class, type/pseudo-element] */
export function specificity(selector) {
  const acc = [0, 0, 0]
  for (const part of splitCombinators(selector)) {
    if (part.type !== 'compound') continue
    const c = parseCompound(part.text)
    if (c.id) acc[0]++
    acc[1] += c.classes.length + c.attrs.length
    if (c.tag) acc[2]++
    for (const p of c.pseudos) {
      if (p.element) { acc[2]++; continue }
      if (p.name === 'where') continue /* contributes nothing, by design */
      if (p.name === 'is' || p.name === 'not' || p.name === 'has') {
        /* The most specific argument, per selectors-4. */
        let best = [0, 0, 0]
        for (const arg of splitTopLevel(p.args || '')) {
          const s = specificity(arg)
          if (compareSpecificity(s, best) > 0) best = s
        }
        acc[0] += best[0]; acc[1] += best[1]; acc[2] += best[2]
        continue
      }
      acc[1]++
    }
  }
  return acc
}

export const compareSpecificity = (a, b) =>
  a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

/* --- the cascade ---------------------------------------------------------- */

import { resolveLayerOrder, orderFromImports } from './layers.js'

/* CSS-wide keywords that leave a registered slot guaranteed-invalid.
 *
 * largen registers every slot with `syntax: "*"`, `inherits: false` and NO
 * `initial-value`, which makes the unset value guaranteed-invalid — that is the
 * whole mechanism behind `var(--x, revert-layer)` in the paint rule. The
 * consequence people meet by accident: `inherit` on such a property asks for the
 * parent's value, the parent does not inherit it either, so what arrives is the
 * initial value, which is guaranteed-invalid. `initial` and `unset` land in the
 * same place by more direct routes.
 *
 * The trap is that `--fg: inherit` reads as "use the surrounding colour" and
 * does the opposite: the slot goes invalid, the paint rule's fallback fires, and
 * the property reverts to the user-agent stylesheet. On a link that is blue. */
export const INVALIDATING_KEYWORDS = new Set(['inherit', 'initial', 'unset'])

/** Where a rule's layer sits. Unlayered author CSS is not a layer and beats every
 *  layer for normal declarations — and loses to every layer when important. */
function layerRank(layer, order) {
  if (!layer) return { index: Infinity, unlayered: true }
  const direct = order.indexOf(layer)
  if (direct >= 0) return { index: direct, unlayered: false }
  /* A block naming `a.b` where only `a` was ever ordered, or vice versa. */
  const parent = layer.split('.')[0]
  const byParent = order.findIndex((l) => l === parent || l.split('.')[0] === parent)
  return { index: byParent >= 0 ? byParent : order.length, unlayered: false }
}

/**
 * Every declaration of one property that could apply to one element, in cascade
 * order, with the winner and why it won.
 *
 * @param {object} options
 * @param {Array<{name,css}>} options.files
 * @param {string} [options.entry]   derive load order from this file's @imports
 * @param {Array<object>} options.path  ancestor chain, outermost first
 * @param {string} options.property
 */
export function resolveProperty({ files, entry, path, property }) {
  if (!Array.isArray(files) || !files.length) throw new Error('files must be a non-empty array of { name, css }')
  if (!Array.isArray(path) || !path.length) throw new Error('path must be a non-empty ancestor chain, outermost first')
  if (typeof property !== 'string' || !property.trim()) throw new Error('property must be a CSS property name')

  let ordered = files
  let derivation = null
  if (entry) {
    const walked = orderFromImports(files, entry)
    ordered = walked.order
    derivation = { from: entry, order: walked.order.map((f) => f.name), unresolved: walked.unresolved, layered: walked.layered, unreached: walked.unreached }
  }

  const { order: layers } = resolveLayerOrder(ordered)
  const counter = { n: 0 }
  const rules = ordered.flatMap((f) => parseStylesheet(f.css, f.name, counter))

  const matched = []
  const undecidable = []

  for (const rule of rules) {
    const decls = rule.declarations.filter((d) => d.property === property)
    if (!decls.length) continue

    /* A selector list is several selectors; the one that matches with the
       highest specificity is the one the cascade uses. */
    let best = null
    const doubts = []
    for (const sel of splitTopLevel(rule.selector)) {
      const r = matchSelector(sel, path)
      if (r.verdict === 'match') {
        const spec = specificity(sel)
        if (!best || compareSpecificity(spec, best.spec) > 0) best = { sel, spec }
      } else if (r.verdict === 'undecidable') {
        doubts.push({ selector: sel, undecidable: r.undecidable })
      }
    }

    const decl = decls[decls.length - 1] /* a later duplicate in one block wins */

    if (best) {
      const rank = layerRank(rule.layer, layers)
      matched.push({
        file: rule.file, line: rule.line, layer: rule.layer, selector: rule.selector,
        matchedBy: best.sel, specificity: best.spec, important: decl.important,
        value: decl.value, order: rule.order, conditions: rule.conditions,
        layerIndex: rank.index, unlayered: rank.unlayered,
      })
    } else if (doubts.length) {
      undecidable.push({
        file: rule.file, line: rule.line, layer: rule.layer, selector: rule.selector,
        value: decl.value, important: decl.important, conditions: rule.conditions,
        why: doubts.flatMap((d) => d.undecidable),
      })
    }
  }

  /* Cascade order for author declarations: importance first, then layer —
     reversed for important — then specificity, then source order. */
  const rank = (d) => [
    d.important ? 1 : 0,
    d.important ? -(d.unlayered ? Infinity : d.layerIndex) : (d.unlayered ? Infinity : d.layerIndex),
  ]
  const sorted = [...matched].sort((a, b) => {
    const ra = rank(a), rb = rank(b)
    if (ra[0] !== rb[0]) return ra[0] - rb[0]
    if (ra[1] !== rb[1]) return ra[1] < rb[1] ? -1 : 1
    const s = compareSpecificity(a.specificity, b.specificity)
    if (s !== 0) return s
    return a.order - b.order
  })

  const winner = sorted[sorted.length - 1] ?? null
  const runnerUp = sorted[sorted.length - 2] ?? null

  return {
    property,
    declarations: sorted,
    winner,
    reason: winner ? explainWin(winner, runnerUp) : null,
    undecidable,
    layerOrder: layers,
    derivation,
    conditional: matched.filter((d) => d.conditions.length).length,
  }
}

/** Say which cascade step decided it, not merely that it won. */
function explainWin(winner, runnerUp) {
  if (!runnerUp) return 'only matching declaration'
  if (winner.important !== runnerUp.important) return '`!important`'
  if (winner.unlayered !== runnerUp.unlayered) {
    return winner.unlayered
      ? 'unlayered author CSS, which beats every cascade layer for normal declarations'
      : 'cascade layer, because the competing declaration is important and importance reverses layer order'
  }
  if (winner.layerIndex !== runnerUp.layerIndex) {
    const sub = winner.layer && winner.layer.includes('.')
    return `layer order — \`${winner.layer}\` sorts after \`${runnerUp.layer}\`` +
      (sub || (runnerUp.layer && runnerUp.layer.includes('.'))
        ? '. A sublayer takes its parent\'s position, which is fixed at the parent\'s first mention, so the order layers are listed in is not always the order they sort in.'
        : '. Layer order beats specificity, so no selector weight recovers this.')
  }
  const s = compareSpecificity(winner.specificity, runnerUp.specificity)
  if (s !== 0) return `specificity ${winner.specificity.join(',')} over ${runnerUp.specificity.join(',')}`
  return 'source order — same layer, same specificity, so the later declaration wins'
}

/* --- does the component's own declaration actually win? --------------------
 *
 * The check `largen verify` could not make, and the reason it could pass clean on
 * a component that was visibly broken.
 *
 * The linter reads one file at a time. Every failure it can see is local: a
 * missing layer, a colour literal, an unregistered slot. The failures that cost
 * the most are not local — a component sets `--weight: 500` inside
 * `largen.components` and something in another file wins, so the declaration is
 * correct, the file is correct, and the element paints something else. Nothing
 * about `--weight: 900` computing as `300` looks like a layer problem to anyone
 * not already suspicious, which is exactly why a verifier should be the one to
 * say it.
 *
 * For an agent this is the difference between a usable loop and a harmful one.
 * generate → validate → repair terminates when validate says clean, so a
 * verifier that returns clean on a broken component does not merely fail to
 * help: it ends the loop with false confidence and hands back something wrong.
 */

/** Turn a selector into an ancestor chain, or null if it cannot be represented.
 *
 *  A chain has no siblings, no child indices and no interaction state, so a
 *  selector that turns on any of those cannot be synthesised. Returning null and
 *  counting it beats inventing an element that the rule would not match. */
export function synthesizePath(selector) {
  const parts = splitCombinators(selector)
  if (parts.some((p) => p.type === 'combinator' && UNDECIDABLE_COMBINATOR[p.text])) return null

  const path = []
  for (const part of parts) {
    if (part.type !== 'compound') continue
    const c = parseCompound(part.text)

    /* A subject written only as `:where(kbd)` or `:is(a, button)` still names an
       element; take the first argument that is a bare compound. */
    let tag = c.tag
    const classes = [...c.classes]
    /* Merge EVERY :where()/:is() on the compound, not the first one that names
       something. `:where(ol, ul):is(.stack, .row)` carries the element in one and
       the class in the other, and taking only the first produced an `<ol>` with no
       class — an element the rule does not match, which then resolved to nothing
       and was reported as a component that never applies. */
    for (const fn of c.pseudos) {
      if (fn.element || !(fn.name === 'where' || fn.name === 'is') || !fn.args) continue
      const first = splitTopLevel(fn.args)[0]
      if (!first || splitCombinators(first).length !== 1) continue
      const inner = parseCompound(first)
      if (!tag) tag = inner.tag
      classes.push(...inner.classes)
      for (const a of inner.attrs) c.attrs.push(a)
    }

    if (c.pseudos.some((p) => !p.element && UNDECIDABLE_PSEUDO[p.name])) return null

    const attrs = {}
    for (const a of c.attrs) {
      const m = a.match(/^\s*([\w-]+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]*)))?\s*$/)
      if (!m) return null
      attrs[m[1]] = m[2] ?? m[3] ?? m[4] ?? ''
    }

    /* `*` and a bare `:where(...)` with nothing nameable inside describe no
       particular element; a component rule is never written that way. */
    if (!tag && !classes.length && !c.id && !Object.keys(attrs).length && !c.universal) return null

    path.push({ tag: tag ?? 'div', id: c.id, classes, attrs })
  }
  return path.length ? path : null
}

/**
 * For every slot a component sets, check that the component's own declaration is
 * the one that wins on an element matching its selector.
 *
 * @param {object} options
 * @param {Array<{name,css}>} options.files  in load order
 * @param {string} [options.entry]           derive load order from @imports instead
 * @param {string[]} options.slots           registered slot names
 * @returns {{findings: object[], checked: number, undecidable: object[]}}
 */
export function checkComponentsApply({ files, entry, slots = [] }) {
  let ordered = files
  if (entry) ordered = orderFromImports(files, entry).order

  const counter = { n: 0 }
  const rules = ordered.flatMap((f) => parseStylesheet(f.css, f.name, counter))
  const SLOTS = new Set(slots)

  const findings = []
  const undecidable = []
  let checked = 0

  for (const rule of rules) {
    if (rule.layer !== 'largen.components') continue

    for (const decl of rule.declarations) {
      if (!SLOTS.has(decl.property)) continue

      const selector = splitTopLevel(rule.selector)[0]
      const path = synthesizePath(selector)
      if (!path) {
        undecidable.push({ file: rule.file, line: rule.line, selector: rule.selector, slot: decl.property })
        continue
      }

      let resolved
      try { resolved = resolveProperty({ files: ordered, path, property: decl.property }) }
      catch { continue }

      checked++
      const winner = resolved.winner
      /* Same file, same rule, same declaration — identified by source order,
         which is unique across the whole run. */
      if (winner && winner.file === rule.file && winner.order === rule.order) continue

      if (!winner) {
        /* Cannot happen for a rule that matches its own selector, so if it does,
           something above is wrong and silence would hide it. */
        findings.push({
          rule: 'component-not-applied', severity: 'error', file: rule.file, line: rule.line,
          message: `\`${decl.property}\` on \`${rule.selector}\` resolves to nothing`,
          why: 'The component sets it, but no declaration wins for an element matching this ' +
            'selector. That should be impossible; treat it as a bug in the check rather than ' +
            'in your CSS, and report it.',
        })
        continue
      }

      findings.push({
        rule: 'component-overridden', severity: 'error', file: rule.file, line: rule.line,
        message:
          `\`${decl.property}: ${decl.value}\` never applies — \`${winner.value}\` from ` +
          `${winner.layer ? `\`${winner.layer}\`` : 'unlayered CSS'} wins on \`${rule.selector}\``,
        why:
          `${resolved.reason}\n        The declaration is correct and the file is correct; the ` +
          'element still paints something else, which is why this does not look like a layer ' +
          `problem. Winning declaration: ${winner.file}:${winner.line}.`,
        winner: { file: winner.file, line: winner.line, layer: winner.layer, value: winner.value },
      })
    }
  }

  return { findings, checked, undecidable }
}
