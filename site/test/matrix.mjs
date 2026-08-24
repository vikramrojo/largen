/* The four-axes claim, checked rather than stated.
 *
 * largen's own documentation says every reference component answers to tone,
 * variant and size "without naming any of them... it is the whole point of the
 * algebra" (site/public/docs/components.html). Nothing had ever run that claim.
 * This does, in two passes — see openspec/changes/conformance-and-eval/design.md,
 * "Split the matrix by question, not by cost", for why there are two and not one.
 *
 *   1. STATIC — genai/matrix.js's checkAxisReach, over every reference
 *      component. Proves, per component per axis, whether the axis reaches at
 *      least one slot: for variant, that a different declaration wins; for
 *      tone/size/theme, that the winning declaration's raw value references
 *      that axis's vocabulary. No browser, milliseconds.
 *
 *   2. RENDERED — a deliberately small sample, via genai/probe.js, confirming
 *      that a handful of the static pass's "value" findings actually produce a
 *      DIFFERENT computed value. Static resolution cannot show that (cascade.js
 *      does not substitute var()); this is the one thing here that needs Chrome.
 *
 * NOT the same "four axes" largen's own header comments use. algebra.css names
 * its four axes tone / variant / size / STATE — state coming from real DOM
 * pseudo-classes (:disabled, :user-invalid, :focus-visible), which
 * resolveProperty cannot decide at all (they are exactly the UNDECIDABLE_PSEUDO
 * set in genai/cascade.js) and which axisCombinations() has no attribute value
 * to represent. This file's four axes are tone / variant / size / THEME, per
 * the interface genai/matrix.js exports, because theme is the one substitution
 * that is both decidable-in-part and load-bearing enough (light/dark swap
 * eleven tokens under every component) to be worth a dedicated axis here. State
 * is real and untested — genai/probe.js already has a `kind: 'interaction'`
 * mode built for exactly that, and it belongs in a separate check, not folded
 * into a 7×4×5×2 matrix it cannot be represented in.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { checkAxisReach, AXES, axisCombinations } from '../../genai/matrix.js'
import { buildProbe } from '../../genai/probe.js'
import { registeredSlots } from '../../genai/lint.js'

const run = promisify(execFile)
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = '/tmp/largen-matrix'
const root = new URL('../../', import.meta.url).pathname
const read = (p) => readFileSync(join(root, p), 'utf8')

let pass = 0, fail = 0
const check = async (name, fn) => {
  try { const d = await fn(); pass++; console.log(`  ok    ${name}${d ? ` — ${d}` : ''}`) }
  catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`) }
}
const assert = (c, m) => { if (!c) throw new Error(m) }

/* --- real files, in real load order ---------------------------------------
 *
 * src/largen.css states the canonical layer order before anything else loads
 * — without it, layer position falls back to first-mention order across this
 * array, and largen.modifiers (first mentioned inside algebra.css) would sort
 * BEFORE largen.components (first mentioned inside layout.css), silently
 * disabling every variant check. Reading largen.css's own @imports keeps this
 * from drifting if that file's load list ever changes; every @import inside it
 * is inert to parseStylesheet (it only reacts to `{`/`}`), so including the
 * whole file costs nothing. */
const CORE = [
  'src/largen.css', 'src/properties.css', 'src/reset.css', 'src/tokens.css',
  'src/paint.css', 'src/algebra.css', 'src/layout.css', 'src/elements.css',
]
const files = [
  ...CORE.map((p) => ({ name: p, css: read(p) })),
  { name: 'themes/light.css', css: read('themes/light.css') },
  { name: 'themes/dark.css', css: read('themes/dark.css') },
  { name: 'components/reference.css', css: read('components/reference.css') },
  { name: 'components/prose.css', css: read('components/prose.css') },
]

const manifest = JSON.parse(read('genai/manifest.json'))
const slots = registeredSlots(read('src/properties.css'))

console.log(`\n  largen matrix — ${AXES.tone.length} tones × ${AXES.variant.length} variants × ` +
  `${AXES.size.length} sizes × ${AXES.theme.length} themes = ${axisCombinations().length} combinations\n` +
  `  ${manifest.components.length} reference components, ${slots.length} slots\n`)

/* --- 1. static: every reference component, every axis ---------------------- */

const result = checkAxisReach({ files, slots, components: manifest.components })

await check('the matrix resolves every reference component with nothing undecidable', () => {
  assert(result.checked > 0, 'checked 0 declarations — the component rules were not found at all')
  if (result.undecidable.length) {
    /* Preserved, not swallowed — the four-answer rule from genai/cascade.js.
       This should not fire for largen's own reference components, which use
       only simple class selectors; if it does, say exactly which one and why,
       rather than silently excluding it from the axis count below. */
    for (const u of result.undecidable) console.log(`        undecidable: ${u.component} — ${u.reason}`)
  }
  assert(result.undecidable.length === 0,
    `${result.undecidable.length} component(s) could not be resolved — see above`)
  return `${result.checked} slot declarations resolved`
})

const byComponent = new Map()
for (const r of result.results) {
  if (!byComponent.has(r.component)) byComponent.set(r.component, {})
  byComponent.get(r.component)[r.axis] = r
}

const AXIS_ORDER = ['tone', 'variant', 'size', 'theme']
const complete = []
const partial = []
for (const [name, axes] of byComponent) {
  const reached = AXIS_ORDER.filter((a) => axes[a].reached)
  if (reached.length === 4) complete.push(name)
  else partial.push({ name, reached, missing: AXIS_ORDER.filter((a) => !axes[a].reached) })
}

console.log(`\n  static reach — ${complete.length}/${byComponent.size} components respond to all four axes\n`)
console.log(`  respond to all four: ${complete.join(', ') || '(none)'}\n`)
for (const p of partial) {
  console.log(`  ${p.name.padEnd(14)} missing: ${p.missing.join(', ')}`)
}
console.log()

/* This is data, not a suite-wide failure condition. Most of what is "missing"
   is real and correct: src/layout.css's stack/row/cluster/grid/center set only
   --gap and --pad, never a colour or a font-size slot, so tone/variant/theme
   structurally have nothing to win and size has nothing to scale — the
   published claim that "every component answers to all four axes" is accurate
   for visually-painted components and does not hold, and should not be read to
   hold, for pure layout utilities. Treating every miss as a hard failure would
   make this suite permanently red for reasons that are not bugs. What SHOULD
   fail the suite is the mechanism itself going quiet — checked reaching 0,
   undecidable results being dropped, or a claimed reach not surviving
   rendering below. */
await check('the check can name components that respond to every axis', () => {
  assert(complete.length > 0, 'zero components pass all four axes — suspicious for a working checker')
  return `${complete.length}: ${complete.join(', ')}`
})

await check('no component is owed an axis it does not receive', () => {
  /* The gate, stated as an assertion rather than as a count.
   *
   * This used to assert that gaps EXIST — `partial.length > 0` — on the reasoning
   * that a checker which always passes has not been proven able to fail. The
   * instinct is right and the placement was wrong: it made the suite pass because
   * largen has gaps and fail if largen were flawless, which is backwards for a
   * gate. Provability belongs in the synthetic fixture below, where breaking
   * something is deliberate and reversible; it does not belong in the assertion
   * that guards the real library. */
  assert(result.findings.length === 0,
    `${result.findings.length} axis(es) owed and not delivered:\n        ` +
    result.findings.map((f) => `${f.component}/${f.axis} — ${f.message}`).join('\n        '))
  const owed = result.results.filter((r) => r.participates).length
  return `${owed} component/axis pairs participate, all delivered`
})

await check('non-participation is reported as data, not as a defect', () => {
  /* A layout utility sets `--gap` and nothing else. It has no colour for a tone to
     change and nothing for a variant to outrank, so an axis is not owed to it and
     reporting one would be a finding no correct repair can clear. Before the gate
     this suite produced seventy-one such errors against a correct library. */
  const abstained = result.results.filter((r) => !r.participates && !r.uses)
  assert(abstained.length > 0, 'every component participates in every axis — the gate is not doing anything')
  for (const r of abstained) {
    assert(!result.findings.some((f) => f.component === r.component && f.axis === r.axis),
      `${r.component} does not participate in ${r.axis} yet was reported as a defect`)
  }
  const byAxis = {}
  for (const r of abstained) byAxis[r.axis] = (byAxis[r.axis] ?? 0) + 1
  return Object.entries(byAxis).map(([a, n]) => `${a}:${n}`).join(' ') + ' abstain, none reported'
})

await check('every finding names a component, an axis and a reason', () => {
  for (const f of result.findings) {
    assert(f.component && f.axis && f.why, `incomplete finding: ${JSON.stringify(f)}`)
  }
  return 'ok'
})

/* --- PROVE IT FAILS: a synthetic fixture, not the real components ----------
 *
 * Editing components/reference.css to prove this and then restoring it is
 * fragile in a test that runs unattended, and unnecessary — the whole point of
 * accepting `files` as an argument is that a synthetic fixture proves the same
 * thing permanently, with no file left mutated if a run is interrupted midway.
 * (The prompt for this task asked to also show the effect against the real
 * file directly, in the session; that was done separately and is reported
 * alongside this suite's output, not encoded here.) */
await check('a component the modifiers cannot outrank is caught', () => {
  const order = { name: 'order.css', css: files[0].css /* src/largen.css: states layer order */ }
  const base = files.slice(1, 10) /* properties, reset, tokens, paint, algebra, layout, elements, themes */
  /* The broken fixture puts the component in a layer that outranks the modifiers.

     Two earlier versions of this proof stopped working as the gate got sharper,
     and each failure was informative. Deleting `--bg` stopped proving anything
     once findings were gated on participation: a component with no colour slot is
     not owed a tone, so the obligation vanished with the ability to meet it.
     Setting `--bg` to a literal then proved a tone gap — but tone is census now,
     not a gate, because a neutral component is not a broken one.

     What IS gated is variant, and its failure is the one that costs most: the
     component is correct, its file is correct, and `data-variant` silently stops
     applying because the rule sits where `largen.modifiers` cannot reach it. That
     is the bug a real migration lost two rounds to.

     The old comment about a literal, kept for the record: */
  /* A literal --bg still participates and tone cannot reach it — the
     "reaches past the tone axis" failure — but that is genai/lint.js's
     colour-literal rule to report, not this one's.
   *
   * Deleting the slot was the first attempt and it stopped working once findings
   * were gated on participation — a component with no colour slot is not owed a
   * tone, so removing --bg removes the obligation along with the ability to meet
   * it, and nothing is reported. Correctly, but it proves nothing.
   *
   * A hardcoded colour is the defect that actually exists in the wild: the
   * component still participates, tone still cannot reach it, and that is exactly
   * the "reaches past the tone axis" failure the contract documents. */
  const working = { name: 'widget.css', css: '@layer largen.components { .widget { --bg: var(--tone); --radius: 50%; } }' }
  /* The component is IDENTICAL and correctly layered. What moves is the order the
     layers sort in: modifiers before components, so the component outranks the
     modifier and `data-variant` has nothing to do. Nothing in the component's own
     file looks wrong, which is the entire difficulty.

     Putting the rule outside largen.components instead would not exercise this
     check at all — a rule in another layer is not a component, and genai/lint.js's
     layer rule is what reports it. */
  const brokenOrder = {
    name: 'order.css',
    css: '@layer largen.reset, largen.tokens, largen.paint, largen.tone,\n' +
      '  largen.elements, largen.modifiers, largen.components;',
  }
  const broken = { name: 'widget.css', css: '@layer largen.components { .widget { --bg: var(--tone); --radius: 50%; } }' }

  const workingResult = checkAxisReach({
    files: [order, ...base, working], slots, components: [{ name: 'widget' }],
  })
  const brokenResult = checkAxisReach({
    files: [brokenOrder, ...base, broken], slots, components: [{ name: 'widget' }],
  })

  const reached = (r, axis) => r.results.find((x) => x.axis === axis)?.reached
  assert(reached(workingResult, 'tone') === true, 'the working fixture should reach tone via var(--tone)')
  assert(reached(workingResult, 'variant') === true, 'the working fixture should reach variant via --bg')
  assert(reached(workingResult, 'theme') === true, 'the working fixture should reach theme (--tone depends on --primary)')
  assert(brokenResult.findings.some((f) => f.component === 'widget' && f.axis === 'variant'),
    'a component the modifiers cannot outrank must be reported — it was not')
  assert(reached(brokenResult, 'variant') === false,
    'variant should be unreached when the component sits after largen.modifiers')
  return 'an identical component silently loses data-variant when the layer order flips, and is reported'
})

/* --- 2. rendered: a deliberate, logged sample -------------------------------
 *
 * Confirms actual computed values differ for a SMALL sample of the static
 * pass's findings — specifically the 'value' ones (tone, size, theme), because
 * those are exactly the claims resolveProperty could not prove on its own (see
 * the file header). 'declaration' findings (variant) are already proven
 * without a browser and are not re-verified here.
 *
 * This is a bound, not coverage of the matrix. Per design.md: "the sample is a
 * deliberate bound and is logged as one, because a silent cap reads as
 * complete coverage." What follows states exactly what was rendered and what
 * was not. */

const SAMPLE_SIZE = 3
const candidates = { tone: [], size: [], theme: [] }
for (const r of result.results) {
  if (r.reached && r.method === 'value' && candidates[r.axis] && candidates[r.axis].length < SAMPLE_SIZE) {
    candidates[r.axis].push(r)
  }
}
const sampled = [...candidates.tone, ...candidates.size, ...candidates.theme]
const totalValueFindings = result.results.filter((r) => r.reached && r.method === 'value').length

console.log(`  rendered sample — ${sampled.length} of ${totalValueFindings} statically-proven ` +
  `"value" reach results (${SAMPLE_SIZE} per axis, tone/size/theme). Not sampled: ` +
  `${totalValueFindings - sampled.length} more value-reach results, and every 'declaration' ` +
  `(variant) result, which does not need rendering to be proven. Full combinatorial space is ` +
  `${axisCombinations().length} states × ${manifest.components.length} components = ` +
  `${axisCombinations().length * manifest.components.length}; none of that space beyond the ` +
  `sample below was rendered.\n`)

const attrsFor = (axis, on) => {
  if (axis === 'theme') return { html: { 'data-theme': on } }
  if (axis === 'tone') return { wrap: { 'data-tone': on } }
  if (axis === 'size') return { wrap: { 'data-size': on } }
  return {}
}

const attrString = (attrs) => Object.entries(attrs).map(([k, v]) => ` ${k}="${v}"`).join('')

function fixtureHtml(css, componentClass, tag, axis, value) {
  const a = attrsFor(axis, value)
  const wrap = a.wrap ? `<div${attrString(a.wrap)}>` : '<div>'
  const wrapClose = '</div>'
  const html = `<${tag} class="${componentClass}" id="subject"></${tag}>`
  return `<!doctype html><html${a.html ? attrString(a.html) : ''}><head><meta charset="utf-8">` +
    `<style>${css}</style></head><body>${wrap}${html}${wrapClose}</body></html>`
}

async function renderedValue(css, componentClass, tag, property, axis, value) {
  const html = fixtureHtml(css, componentClass, tag, axis, value)
  const probe = buildProbe({ kind: 'computed', html, selectors: ['#subject'], properties: [property], timeout: 5000 })
  mkdirSync(OUT, { recursive: true })
  const file = join(OUT, `${componentClass}-${axis}-${value}.html`)
  writeFileSync(file, probe)
  const { stdout } = await run(CHROME, [
    '--headless', '--disable-gpu', '--virtual-time-budget=6000', '--dump-dom', `file://${file}`,
  ], { timeout: 60_000, maxBuffer: 32 * 1024 * 1024 })
  const m = stdout.match(/<pre id="json"[^>]*>([\s\S]*?)<\/pre>/)
  if (!m || !m[1].trim()) throw new Error('probe produced no results')
  const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  const out = JSON.parse(unescape(m[1]))
  if (out.error) throw new Error(out.error)
  if (!out.rows.length || out.rows[0].missing) throw new Error('#subject not found')
  return out.rows[0].values[property]
}

let chromeAvailable = true
try { await run(CHROME, ['--version'], { timeout: 10_000 }) }
catch { chromeAvailable = false }

const allCss = files.map((f) => f.css).join('\n')
const byName = new Map(manifest.components.map((c) => [c.name, c]))

if (!chromeAvailable) {
  /* Per the conformance requirement this mirrors: report that rendering did
     not run, and fail — a suite that quietly skips its own browser half and
     still exits 0 is the exact failure this whole change exists to close. */
  fail++
  console.log(`  FAIL  rendered sample — Chrome not found at ${CHROME}\n` +
    '        set CHROME=/path/to/chrome, or install it, to run the rendered half.\n')
} else {
  for (const s of sampled) {
    const label = `rendered: ${s.component} ${s.axis} (${s.evidence.slot} via ${s.evidence.via})`
    await check(label, async () => {
      const comp = byName.get(s.component)
      const tag = comp?.element ?? 'div'
      const property = s.evidence.slot
      const values = AXES[s.axis]
      const a = values[0], b = values[1] ?? values[values.length - 1]
      const va = await renderedValue(allCss, s.component, tag, property, s.axis, a)
      const vb = await renderedValue(allCss, s.component, tag, property, s.axis, b)
      assert(va !== '' || vb !== '', `${property} computed empty under both ${a} and ${b} — nothing rendered`)
      assert(va !== vb,
        `${property} computed the same value ("${va}") under ${s.axis}=${a} and ${s.axis}=${b} — ` +
        'the static pass found a reference to axis vocabulary, but the browser did not compute a ' +
        'different result. Either the vocabulary derivation over-matched, or this is a real bug.')
      return `${a}=${JSON.stringify(va)} vs ${b}=${JSON.stringify(vb)}`
    })
  }
  if (!sampled.length) {
    console.log('  (no value-method reach results to sample — nothing rendered)')
  }
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
