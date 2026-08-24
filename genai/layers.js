/* Resolve cascade layer order across a set of stylesheets.
 *
 * Zero dependencies. This is the one class of bug in largen's field reports that
 * a linter genuinely could have caught, and the reason it is worth catching is
 * that the symptom points somewhere else: a declaration in a layer you believe
 * is losing computes as though it won, and nothing about `--weight: 900` coming
 * out as `300` says "layer order" to anyone not already suspicious.
 *
 * TWO RULES DO ALL THE WORK
 *
 *   1. A layer's position is fixed the FIRST time it is mentioned. A later
 *      `@layer` statement listing it again does not move it.
 *   2. A sublayer takes its parent's position. `site.base` and `site.overrides`
 *      are both children of `site`, which has one position, so they cannot
 *      straddle a third layer no matter what order you list them in.
 *
 * Together those mean a statement can read exactly like the order you want and
 * produce a different one. That is not a bug in CSS; it is a consequence people
 * discover by losing an afternoon.
 *
 * WHAT THIS DOES NOT DO
 *
 * It reads text. It does not know what a browser fetched, in what order, or what
 * a bundler inlined. Give it the stylesheets in the order the document loads
 * them; if that order is wrong the answer is wrong, and no static tool can tell.
 */

const STATEMENT = /@layer\s+([^{};]+);/g
const BLOCK = /@layer\s+([\w-]+(?:\.[\w-]+)*)\s*\{/g

const parentOf = (name) => name.split('.')[0]

/**
 * @param {Array<{name: string, css: string}>} files  in document load order
 * @returns {{order: string[], mentions: object[], statements: object[]}}
 */
export function resolveLayerOrder(files) {
  /* Top-level layers in creation order, each holding its sublayers in creation
     order. Modelling the parent explicitly is the whole point — flattening as we
     go would lose exactly the constraint that causes the bug. */
  const parents = []
  const subs = new Map()
  const mentions = []
  const statements = []

  const touch = (name, where, kind) => {
    const parent = parentOf(name)
    if (!subs.has(parent)) { parents.push(parent); subs.set(parent, []) }
    const sub = name.includes('.') ? name : null
    if (sub && !subs.get(parent).includes(sub)) subs.get(parent).push(sub)
    mentions.push({ layer: name, parent, file: where, kind })
  }

  for (const { name: file, css } of files) {
    const clean = String(css).replace(/\/\*[\s\S]*?\*\//g, '')
    /* Statements and blocks interleave, and order between them matters, so walk
       one merged, position-sorted list rather than each kind in turn. */
    const events = []
    for (const m of clean.matchAll(STATEMENT)) {
      const listed = m[1].split(',').map((x) => x.trim()).filter(Boolean)
      if (listed.some((l) => !/^[\w-]+(\.[\w-]+)*$/.test(l))) continue
      events.push({ at: m.index, kind: 'statement', listed })
    }
    for (const m of clean.matchAll(BLOCK)) events.push({ at: m.index, kind: 'block', listed: [m[1]] })
    events.sort((a, b) => a.at - b.at)

    for (const e of events) {
      if (e.kind === 'statement') statements.push({ file, listed: e.listed })
      for (const l of e.listed) touch(l, file, e.kind)
    }
  }

  const order = []
  for (const p of parents) {
    const children = subs.get(p)
    if (children.length) order.push(...children)
    else order.push(p)
  }
  return { order, mentions, statements }
}

/**
 * Compare each `@layer` statement's declared sequence against where those layers
 * actually sort, and explain any difference.
 *
 * @returns {{ok: boolean, order: string[], findings: object[]}}
 */
export function checkLayerOrder(files) {
  const { order, mentions, statements } = resolveLayerOrder(files)
  const index = new Map(order.map((l, i) => [l, i]))
  const findings = []

  const positionOf = (name) =>
    index.has(name) ? index.get(name)
      : order.findIndex((l) => parentOf(l) === parentOf(name))

  for (const st of statements) {
    const listed = st.listed.filter((l) => positionOf(l) >= 0)
    for (let i = 0; i < listed.length - 1; i++) {
      const a = listed[i], b = listed[i + 1]
      if (positionOf(a) < positionOf(b)) continue

      /* Same parent on both sides of something else is the sublayer trap, and it
         deserves its own message — "these cannot straddle" is actionable where
         "order differs" is not. */
      const straddled = st.listed.slice(i + 1).find((c) =>
        parentOf(c) !== parentOf(a) && st.listed.slice(st.listed.indexOf(c) + 1)
          .some((d) => parentOf(d) === parentOf(a)))

      if (parentOf(a) !== a && straddled) {
        findings.push({
          rule: 'sublayer-straddle',
          severity: 'error',
          file: st.file,
          layers: [a, straddled],
          message: `\`${a}\` and its sibling cannot sit either side of \`${straddled}\``,
          why:
            `\`${a}\` is a sublayer of \`${parentOf(a)}\`, and a sublayer takes its ` +
            `parent's position. \`${parentOf(a)}\` has one position, so every ` +
            `\`${parentOf(a)}.*\` layer sorts together — they cannot straddle ` +
            `\`${straddled}\`. Use flat names (\`${parentOf(a)}-base\`, ` +
            `\`${parentOf(a)}-overrides\`) so the two halves are independent layers ` +
            `that can sit on either side.`,
        })
      } else {
        const first = mentions.find((m) => m.layer === b || parentOf(m.layer) === parentOf(b))
        findings.push({
          rule: 'declared-order-not-achieved',
          severity: 'error',
          file: st.file,
          layers: [a, b],
          message: `declared \`${a}\` before \`${b}\`, but \`${b}\` sorts first`,
          why:
            `A layer's position is fixed at its first mention, and \`${b}\` was ` +
            `already positioned` + (first ? ` (first seen in ${first.file})` : '') +
            `. Listing it again does not move it. Declare every layer in one ` +
            `statement, before anything that creates them — for a framework's base ` +
            `layer that means putting it in that statement ahead of largen, or it ` +
            `sorts last and flattens what largen styled. Layer order beats ` +
            `specificity, so no selector weight recovers it.`,
        })
      }
    }
  }

  const seen = new Set()
  const unique = findings.filter((f) => {
    const k = f.rule + f.layers.join('>')
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  return { ok: unique.length === 0, order, findings: unique }
}

export default checkLayerOrder

/* ---------------------------------------------------------------------------
 * Deriving load order instead of taking it on trust.
 *
 * The header above admits the one place this module can be silently wrong: it
 * is handed files in an order and believes it. For the common setup that order
 * is derivable — a single entry stylesheet whose `@import` sequence IS the load
 * order — so believing the caller is a choice, not a necessity.
 *
 * Everything here works on the provided set of {name, css}. Nothing touches a
 * filesystem: the MCP server receives strings, and a resolver that reached for
 * disk would work in the CLI and fail over the wire.
 */

/* `@import` has more spellings than the url() form. All five of these load a
   stylesheet, and a regex that knows only the first quietly derives a short
   order and calls it complete:
       @import url("a.css");   @import url('a.css');   @import url(a.css);
       @import "a.css";        @import 'a.css';
   The trailing group captures anything before the semicolon — layer(), supports()
   and media conditions — because an import can carry them and they change what
   the import means. */
const IMPORT_ANY =
  /@import\s+(?:url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]*))\s*\)|"([^"]*)"|'([^']*)')([^;]*);/g

/** Resolve a specifier against the importing file's directory, posix-style.
 *  Deliberately not node:path — these are stylesheet names carried in a payload,
 *  not paths on this machine, and on Windows node:path would join with a
 *  backslash and match nothing. */
function resolveSpec(fromName, spec) {
  if (/^(https?:)?\/\//.test(spec)) return null /* remote: not in the set, by definition */
  const base = fromName.includes('/') ? fromName.slice(0, fromName.lastIndexOf('/')) : ''
  /* `base` is empty when the importing file has no directory in its name, which
     is the common case for stylesheets passed over the wire as `main.css`.
     Joining unconditionally would produce `/largen.css` and make a relative name
     spuriously absolute, so it would then match nothing. */
  const joined = spec.startsWith('/') ? spec : (base ? `${base}/${spec}` : spec)
  /* Keep the leading slash. Normalising by dropping empty segments erases it,
     and then an absolute name never matches the absolute name it was resolved
     from — which is exactly the shape the CLI passes, where the files are named
     by their real paths. */
  const absolute = joined.startsWith('/')
  const out = []
  for (const p of joined.split('/')) {
    if (!p || p === '.') continue
    if (p === '..') out.pop()
    else out.push(p)
  }
  return (absolute ? '/' : '') + out.join('/')
}

/**
 * Walk an entry stylesheet's `@import` graph and return the files in load order.
 *
 * A file imported twice loads once, at its first position, and a cycle
 * terminates — same reasoning as the bundler's inlineImports, and the same
 * situation arises here because two entry points can reach one shared partial.
 *
 * @param {Array<{name: string, css: string}>} files  the available set, any order
 * @param {string} entry  the name of the entry stylesheet within that set
 * @returns {{order: Array<{name,css}>, unresolved: object[], layered: object[], unreached: string[]}}
 */
export function orderFromImports(files, entry) {
  const byName = new Map(files.map((f) => [f.name, f]))
  if (!byName.has(entry)) {
    const err = new Error(`entry \`${entry}\` is not among the ${files.length} file(s) provided`)
    err.code = 'ENTRY_NOT_FOUND'
    throw err
  }

  const order = []
  const seen = new Set()
  const unresolved = []
  const layered = []

  const walk = (name) => {
    if (seen.has(name)) return
    seen.add(name)
    const file = byName.get(name)
    /* Blanked, not deleted: offsets into `clean` are used to slice the original
       below, and removing the comments outright shifts every index after the
       first one. largen's own stylesheets open with a 24-line comment, so the
       slice landed inside it and the prelude came back empty. */
    const clean = String(file.css).replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))

    /* Depth-first, and the importing file is appended AFTER its imports — which
       is what the cascade sees for its declarations. `@import` must precede every
       other rule, so a file's own rules follow everything it pulled in.
     *
     * With one exception, and it is the one that decides layer order. A `@layer`
     * STATEMENT is allowed before `@import`, and that is where a stylesheet
     * declares the order of its layers. Treating the file as atomic put that
     * statement after every file it imports, so layers created by those files
     * were already positioned and the statement appeared to be trying to move
     * them. src/largen.css does exactly this — the statement, then the imports —
     * and the check reported largen's own layer order as unachievable.
     *
     * So the leading statements are emitted as their own entry, before the
     * imports, which is where the browser sees them. */
    const firstImport = clean.search(IMPORT_ANY)
    if (firstImport > 0) {
      const prelude = String(file.css).slice(0, firstImport)
      if (/@layer\s+[^{};]+;/.test(prelude.replace(/\/\*[\s\S]*?\*\//g, ''))) {
        order.push({ name: `${name} (layer statement)`, css: prelude, prelude: true })
      }
    }

    for (const m of clean.matchAll(IMPORT_ANY)) {
      const spec = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5]
      const trailing = (m[6] || '').trim()
      const target = resolveSpec(name, spec)

      /* `@import … layer(x)` wraps the imported sheet in a layer that the
         imported file never mentions. Reporting it beats guessing: the order
         this returns would be right and the layer attribution wrong. */
      if (/\blayer\s*\(/.test(trailing) || /\blayer\b/.test(trailing)) {
        layered.push({ in: name, spec, condition: trailing })
      }

      if (target === null) { unresolved.push({ in: name, spec, why: 'remote stylesheet, not in the provided set' }); continue }
      if (!byName.has(target)) { unresolved.push({ in: name, spec, resolved: target, why: 'no file with that name was provided' }); continue }
      walk(target)
    }
    order.push(file)
  }

  walk(entry)

  /* A file in the set the entry never reaches is not part of this load order.
     Saying so beats appending it somewhere plausible. */
  const unreached = files.map((f) => f.name).filter((n) => !seen.has(n))
  return { order, unresolved, layered, unreached }
}

/**
 * Which of these stylesheets does the document load first?
 *
 * Deriving the cascade needs the load order, and a directory walk is not it. An
 * entry point is the file nothing else imports that imports something — exactly
 * one such file means the graph is unambiguous. More than one, or none, and the
 * honest answer is that we do not know, which callers report rather than guess.
 *
 * Lives here rather than in a CLI script because it is the input `orderFromImports`
 * needs and because two commands want it. It was written twice — once in
 * `verify`, once in `eval` — and the two copies had already drifted apart by the
 * time anyone looked. That is the failure this module's neighbours exist to avoid:
 * `genai/lint.js` says it in its own header, that a rule written twice guarantees
 * the two answers eventually differ.
 *
 * @param {Array<{name: string, css: string}>} files
 * @returns {string|null} the entry's name, or null when it cannot be determined
 */
export function inferEntry(files) {
  const imported = new Set()
  const importers = []

  for (const file of files) {
    const clean = String(file.css).replace(/\/\*[\s\S]*?\*\//g, '')
    let any = false
    for (const m of clean.matchAll(IMPORT_ANY)) {
      const spec = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5]
      const target = resolveSpec(file.name, spec)
      /* Remote imports resolve to null and are not candidates for an entry. */
      if (target === null) continue
      any = true
      imported.add(target)
    }
    if (any) importers.push(file.name)
  }

  const roots = importers.filter((name) => !imported.has(name))
  return roots.length === 1 ? roots[0] : null
}

/* Stylesheet hrefs, in the order the document links them.
 *
 * `@import` is one way a page states its load order. A `<link>` is the other, and
 * it is the more common one — a page links its framework and then its own sheet,
 * with no CSS entry point anywhere. Every tool here that needs an order was built
 * to walk `@import` and therefore reported NOT RUN for exactly the arrangement
 * most projects use.
 *
 * Two people found this independently within a day: the harness that scores
 * authored pages, and an agent authoring one, which reverse-engineered the
 * requirement from an error message and hand-built a throwaway entry file to get
 * past it. Two independent discoveries of the same missing feature is the signal
 * that it is missing.
 *
 * Remote hrefs are dropped: a CDN stylesheet is not in the set being reasoned
 * about, and pretending otherwise would put a name in the order that resolves to
 * nothing. */
const LINK = /<link\b[^>]*>/gi

export function linkOrder(html) {
  const out = []
  for (const tag of String(html).replace(/<!--[\s\S]*?-->/g, '').match(LINK) ?? []) {
    if (!/\brel\s*=\s*["']?stylesheet\b/i.test(tag)) continue
    const href = (tag.match(/\bhref\s*=\s*["']([^"']+)["']/i) ?? [])[1]
    if (!href || /^(https?:)?\/\//.test(href) || href.startsWith('data:')) continue
    out.push(href)
  }
  return out
}

/**
 * Load order taken from a document's `<link>` sequence rather than an `@import`
 * graph, returning the same shape as `orderFromImports` so callers treat them
 * alike.
 *
 * A linked stylesheet may itself `@import` others, so each one is walked.
 *
 * @param {Array<{name,css}>} files  the available set
 * @param {string} htmlName          name of the HTML file within it
 */
export function orderFromHtml(files, htmlName) {
  const byName = new Map(files.map((f) => [f.name, f]))
  const html = byName.get(htmlName)
  if (!html) {
    const err = new Error(`entry \`${htmlName}\` is not among the ${files.length} file(s) provided`)
    err.code = 'ENTRY_NOT_FOUND'
    throw err
  }

  const order = []
  const seen = new Set()
  const unresolved = []
  const layered = []

  for (const href of linkOrder(html.css)) {
    const target = resolveSpec(htmlName, href)
    if (target === null || !byName.has(target)) {
      unresolved.push({ in: htmlName, spec: href, resolved: target, why: 'no file with that name was provided' })
      continue
    }
    /* Each linked sheet may pull in more; walking it keeps a framework's own
       @import graph in the order the browser would build it. */
    const sub = orderFromImports([...files], target)
    for (const f of sub.order) {
      if (seen.has(f.name)) continue
      seen.add(f.name)
      order.push(f)
    }
    unresolved.push(...sub.unresolved)
    layered.push(...sub.layered)
  }

  const unreached = files.map((f) => f.name).filter((n) => n !== htmlName && !seen.has(n))
  return { order, unresolved, layered, unreached, from: 'link order' }
}
