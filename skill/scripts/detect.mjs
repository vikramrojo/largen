/* Component detection: find the components in a stylesheet.
 *
 * The query is the one the deleted build-time generator used —
 *
 *   a rule that is a single compound selector and declares at least one
 *   registered slot
 *
 * — and it is worth stating why each half is there. "Declares a slot" is what
 * separates a component from a layout helper: a rule that sets no slot paints
 * nothing and so has nothing for the axes to act on. "Single compound selector"
 * is what separates a component from its own internals: `.callout > summary` is
 * part of the callout, not a second component.
 *
 * State and attribute variations collapse into the component they vary:
 * `.nav-link`, `.nav-link:hover` and `.nav-link[aria-current]` are one component
 * reported once, with the union of the slots they set.
 *
 * Hand-rolled rather than run through a CSS parser, because the annotations this
 * reads live in comments and a parser throws comments away.
 */

const COMBINATOR = /[ >+~]/

/** Read a `{ … }` block starting at the opening brace; returns [body, indexAfter]. */
function readBlock(css, open) {
  let depth = 0, i = open
  for (; i < css.length; i++) {
    const c = css[i]
    if (c === '/' && css[i + 1] === '*') { i = css.indexOf('*/', i + 2); if (i < 0) return [css.slice(open + 1), css.length]; i++; continue }
    if (c === '"' || c === "'") { const q = c; i++; while (i < css.length && css[i] !== q) { if (css[i] === '\\') i++; i++ } continue }
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) return [css.slice(open + 1, i), i + 1] }
  }
  return [css.slice(open + 1), css.length]
}

/** Declarations written directly on this rule — nested rules are somebody else's. */
function ownDeclarations(body) {
  let out = '', i = 0
  while (i < body.length) {
    const c = body[i]
    if (c === '/' && body[i + 1] === '*') { const e = body.indexOf('*/', i + 2); i = e < 0 ? body.length : e + 2; continue }
    if (c === '{') { const [, after] = readBlock(body, i); i = after; continue }
    out += c; i++
  }
  return out
}

/** `.nav-link:hover` → `nav-link`. Returns null for anything that is not a
 *  single class or custom-element compound. */
function baseName(part) {
  if (COMBINATOR.test(part)) return null
  const head = part.replace(/[:[].*$/s, '')
  const m = head.match(/^\.([a-zA-Z][\w-]*)$/)
  return m ? m[1] : null
}

/** Custom-element co-selectors (`.card, card`) are the same component written
 *  twice; only the class form names it. */
function isCustomElementForm(part) {
  return !COMBINATOR.test(part) && /^[a-z][\w-]*-[\w-]*(?:[:[].*)?$/s.test(part)
}

function inferElement(decls, name) {
  const display = decls.match(/(?:^|[;{\s])display\s*:\s*([^;]+)/)
  if (display && /\binline(?!-size)/.test(display[1])) return 'span'
  if (/(^|-)(list|items|menu|crumbs|steps|nav)$/.test(name)) return 'ul'
  return 'div'
}

/**
 * @param {string} css        stylesheet source
 * @param {Set<string>|string[]} slots  registered slot names
 * @returns {{components: object[], skipped: object[]}}
 */
export function detectComponents(css, slots) {
  const SLOTS = new Set(slots)
  const found = new Map()
  const skipped = []

  let i = 0, prelude = '', annotation = null

  const slotsIn = (decls) => {
    const hit = []
    for (const m of decls.matchAll(/(?:^|[;{\s])(--[\w-]+)\s*:/g)) if (SLOTS.has(m[1])) hit.push(m[1])
    return hit
  }

  while (i < css.length) {
    const c = css[i]

    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      const text = css.slice(i + 2, end < 0 ? css.length : end)
      const m = text.match(/@largen\s+([\s\S]*)/)
      /* Only a comment sitting immediately before a rule annotates it — one
         inside a selector list is not describing anything. */
      if (m && prelude.trim() === '') {
        annotation = m[1].replace(/\s*\*+\s*/g, ' ').replace(/\s+/g, ' ').trim()
      }
      i = end < 0 ? css.length : end + 2
      continue
    }

    if (c === '{') {
      const sel = prelude.trim().replace(/\s+/g, ' ')
      prelude = ''
      if (sel.startsWith('@')) { i++; continue }   /* descend into @layer / @media */

      const [body, after] = readBlock(css, i)
      i = after

      const decls = ownDeclarations(body)
      const hitSlots = slotsIn(decls)
      const parts = sel.split(',').map((s) => s.trim()).filter(Boolean)
      const compound = parts.filter((p) => !COMBINATOR.test(p))
      const named = compound.map(baseName).filter(Boolean)

      if (!compound.length) skipped.push({ selector: sel, reason: 'uses a combinator — part of a component, not one' })
      else if (!hitSlots.length) skipped.push({ selector: sel, reason: 'declares no registered slot — paints nothing' })
      else if (!named.length && compound.every(isCustomElementForm)) {
        skipped.push({ selector: sel, reason: 'custom-element form only' })
      } else if (!named.length) skipped.push({ selector: sel, reason: 'not a class compound selector' })
      else {
        for (const name of new Set(named)) {
          const existing = found.get(name)
          if (existing) {
            for (const s of hitSlots) existing.slots.add(s)
            if (!existing.description && annotation) existing.description = annotation
            existing.rules++
          } else {
            found.set(name, {
              name,
              description: annotation ?? null,
              slots: new Set(hitSlots),
              element: inferElement(decls, name),
              rules: 1,
            })
          }
        }
      }
      annotation = null
      continue
    }

    if (c === '}') { prelude = ''; annotation = null; i++; continue }
    if (c === ';' && prelude.trim().startsWith('@')) { prelude = ''; i++; continue }

    prelude += c
    i++
  }

  const components = [...found.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ name: c.name, description: c.description, element: c.element, slots: [...c.slots].sort(), rules: c.rules }))

  return { components, skipped }
}

export default detectComponents
