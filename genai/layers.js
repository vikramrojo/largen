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
