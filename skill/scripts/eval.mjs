/* `largen eval` — score a directory of authored components against the
 * authoring contract. Offline, deterministic, no model.
 *
 * THE INVERSION THIS COMMAND IS BUILT ON
 *
 * The obvious reading of "eval" is that it drives a model and judges what comes
 * back, which puts an API key and a network call inside a package whose first
 * claim is that it needs no toolchain. That is backwards for largen specifically:
 * the agent that authored the components is already present by the time anyone
 * runs this. So `eval` does not generate anything — it takes directories of
 * finished work and scores them against rules that already exist in this
 * repository: `genai/lint.js`, `genai/cascade.js`, `genai/probe.js`, and (when
 * present) `genai/matrix.js`. Every number below traces to one of those, on
 * purpose — a score that looks deterministic but actually encodes an opinion is
 * exactly what this command must never produce.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *
 * Whether a component looks right. That needs a rendered browser and, for
 * anything subtler than a computed-style readout, a judge — `largen probe` and
 * an agent looking at a screenshot, not this file. Scoring conformance and
 * scoring appearance are different questions, and collapsing them into one
 * number is the mistake this command exists to avoid.
 */
import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, basename } from 'node:path'
import { at, discover } from './paths.mjs'
import { lintComponentCss, registeredSlots, classifySheet, strip } from '../../genai/lint.js'
import { checkComponentsApply } from '../../genai/cascade.js'
import { inferEntry } from '../../genai/layers.js'
import { buildProbe } from '../../genai/probe.js'
import { detectComponents } from './detect.mjs'

/* --- theme detection for the probe ----------------------------------------
 *
 * `[data-theme="dark"]` is largen's own theme mechanism (see themes/*.css) and
 * the one most authored components will be checked against. A component
 * directory that never mentions the attribute is not necessarily untested —
 * it may simply not swap themes — so absence produces a single-theme probe
 * rather than an error. */
function detectThemeNames(sheets) {
  const names = new Set()
  for (const s of sheets) {
    for (const m of strip(s.css).matchAll(/\[data-theme=["']?([\w-]+)["']?\]/g)) names.add(m[1])
  }
  return [...names].sort()
}

/* --- one directory's score --------------------------------------------- */

function scoreDirectory(dirPath, { entryArg, slots } = {}) {
  const abs = resolve(dirPath)
  if (!existsSync(abs) || !statSync(abs).isDirectory()) {
    throw new Error(`not a directory: ${dirPath}`)
  }

  const files = discover(abs)
  if (!files.length) throw new Error(`no CSS found under ${dirPath}`)

  const rel = (f) => relative(abs, f).split('\\').join('/') || basename(f)
  const sheets = files.map((f) => ({ name: rel(f), css: readFileSync(f, 'utf8') }))

  const classified = sheets.map((s) => ({ ...s, kind: classifySheet(s.css, slots).kind }))
  const components = classified.filter((s) => s.kind === 'component')
  const skipped = {
    nonComponent: classified.filter((s) => s.kind === 'not-component').length,
    minified: classified.filter((s) => s.kind === 'minified').length,
  }

  if (!components.length) {
    throw new Error(
      `no component stylesheets found under ${dirPath} (${sheets.length} CSS file(s) seen). ` +
      'A component is declared inside `@layer largen.components`.')
  }

  /* --- the contract: colour literals, raw-semantic escapes, layer placement,
     and everything else genai/lint.js already knows how to find. One rule ->
     one counter, so the report never claims a category the linter didn't
     actually check. */
  const counts = {
    layer: 0, 'colour-literal': 0, 'raw-semantic-token': 0,
    'unregistered-slot': 0, 'tone-contrast-unpaired': 0, important: 0,
  }
  const lintFindings = []
  for (const c of components) {
    const { findings } = lintComponentCss(c.css, { slots })
    for (const f of findings) {
      counts[f.rule] = (counts[f.rule] ?? 0) + 1
      lintFindings.push({ file: c.name, ...f })
    }
  }
  const perComponent = (n) => +(n / components.length).toFixed(3)

  /* --- component census, for axis coverage and the token count ----------- */
  const detected = new Map()
  for (const c of components) {
    const { components: found } = detectComponents(c.css, slots)
    for (const d of found) {
      const prev = detected.get(d.name)
      if (prev) prev.slots = [...new Set([...prev.slots, ...d.slots])].sort()
      else detected.set(d.name, d)
    }
  }
  const componentList = [...detected.values()].sort((a, b) => a.name.localeCompare(b.name))

  /* --- does the declaration actually win? (checkComponentsApply) --------- */
  const entryUsed = entryArg ?? inferEntry(sheets)
  let cascade
  if (!entryUsed) {
    cascade = {
      ran: false,
      reason: 'no entry stylesheet — the load order across files is unknown; pass --entry',
    }
  } else {
    const applies = checkComponentsApply({ files: sheets, entry: entryUsed, slots })
    cascade = {
      ran: true,
      entry: entryUsed,
      checked: applies.checked,
      neverApplies: applies.findings.length,
      undecidable: applies.undecidable.length,
      findings: applies.findings.map((f) => ({ file: f.file, line: f.line, rule: f.rule, message: f.message })),
    }
  }

  /* --- theme survival: emit a probe, do not run one ----------------------
   *
   * No model, no network, no browser here — a probe document is built (the
   * same generator `largen probe` uses) and handed back for the caller to
   * open. Reporting a pass/fail for "does it survive a theme swap" without a
   * browser would be exactly the approximated-judgement this metric must not
   * become, so it is deliberately left unscored. */
  const themeNames = detectThemeNames(sheets)
  const probeSelectors = componentList.map((c) => `[data-largen-eval="${c.name}"]`)
  const probeProperties = [...new Set(componentList.flatMap((c) => c.slots))]
  let themeSurvival
  if (!componentList.length || !probeProperties.length) {
    themeSurvival = { available: false, reason: 'no detected component sets a registered slot to probe' }
  } else {
    const probeHtml = buildProbe({
      kind: 'computed',
      html: `<!doctype html><html><head><style>${
        sheets.map((s) => `/* ${s.name} */\n${s.css}`).join('\n\n')
      }</style></head><body>${
        componentList.map((c) => `<${c.element || 'div'} data-largen-eval="${c.name}">${c.name}</${c.element || 'div'}>`).join('\n')
      }</body></html>`,
      selectors: probeSelectors,
      properties: probeProperties,
      themes: themeNames.length ? themeNames : [null],
    })
    themeSurvival = {
      available: true,
      scored: false,
      note: 'not scored here — rendering a theme swap needs a browser. Open the probe, or pass --probe-out to save it.',
      selectors: probeSelectors.length,
      properties: probeProperties.length,
      themes: themeNames.length || 1,
      bytes: Buffer.byteLength(probeHtml, 'utf8'),
      html: probeHtml,
    }
  }

  /* --- tokens per component ------------------------------------------------
   *
   * A count, not a judgement: how many custom properties each detected
   * component declares and reads, on average, over the files scored. This
   * says nothing about whether they are the RIGHT properties — that is what
   * the lint findings above are for. */
  const SET_RE = /(?:^|[;{\s])(--[\w-]+)\s*:/g
  const READ_RE = /var\(\s*--[\w-]+/g
  let totalSet = 0, totalRead = 0
  for (const c of components) {
    const clean = strip(c.css)
    totalSet += (clean.match(SET_RE) || []).length
    totalRead += (clean.match(READ_RE) || []).length
  }
  const tokens = {
    componentsDetected: componentList.length,
    totalSet,
    totalRead,
    avgSetPerComponent: componentList.length ? +(totalSet / componentList.length).toFixed(2) : null,
    avgReadPerComponent: componentList.length ? +(totalRead / componentList.length).toFixed(2) : null,
  }

  return {
    dir: dirPath,
    files: { total: sheets.length, components: components.length, skipped },
    contract: {
      counts,
      escapeRates: {
        colourLiteral: perComponent(counts['colour-literal']),
        rawSemanticToken: perComponent(counts['raw-semantic-token']),
        layerPlacement: perComponent(counts.layer),
      },
      findings: lintFindings,
    },
    cascade,
    themeSurvival,
    tokens,
    /* Not resolved yet — genai/matrix.js may not exist in this build, and
       finding out means an async import. Filled in by score() below. */
    _sheets: sheets, _entryUsed: entryUsed, _slots: slots, _componentList: componentList,
  }
}

/* --- axis coverage (genai/matrix.js) --------------------------------------
 *
 * Written against a signature another change is implementing concurrently:
 *   checkAxisReach({ files, entry, slots, components }) -> { results, findings,
 *   checked, undecidable }
 * If the module is not there yet, or throws, that is not this command's
 * failure — it is reported as an unavailable metric, never swallowed and
 * never faked as a passing or failing score. */
async function computeAxisCoverage({ sheets, entryUsed, slots, componentList }) {
  let mod
  try {
    mod = await import('../../genai/matrix.js')
  } catch {
    return { available: false, reason: 'genai/matrix.js is not present in this build yet' }
  }
  if (typeof mod.checkAxisReach !== 'function') {
    return { available: false, reason: 'genai/matrix.js exists but does not export checkAxisReach' }
  }
  if (!entryUsed) {
    return { available: false, reason: 'no entry stylesheet — pass --entry to derive load order' }
  }
  try {
    const r = mod.checkAxisReach({ files: sheets, entry: entryUsed, slots, components: componentList })
    return {
      available: true,
      checked: r.checked,
      findings: (r.findings ?? []).length,
      undecidable: (r.undecidable ?? []).length,
    }
  } catch (e) {
    return { available: false, reason: `checkAxisReach threw: ${e.message}` }
  }
}

/* Resolve the async axis-coverage check without making scoreDirectory itself
   async — it stays a small, synchronous, easily-testable function, and the
   one part of scoring that has to await a maybe-missing module does so here. */
async function score(dirPath, opts) {
  const result = scoreDirectory(dirPath, opts)
  const { _sheets, _entryUsed, _slots, _componentList, ...rest } = result
  const axisCoverage = await computeAxisCoverage({
    sheets: _sheets, entryUsed: _entryUsed, slots: _slots, componentList: _componentList,
  })
  return { ...rest, axisCoverage }
}

/* --- reporting -------------------------------------------------------- */

const CONFORMANCE_NOTE =
  'Conformance is not appearance. These numbers measure rule-following against\n' +
  'the authoring contract; none of them render anything. A component can score\n' +
  'perfectly here and still look wrong. Render it: `largen probe`, and the\n' +
  'rendered conformance suite (demo/conformance.html).'

const ASYMMETRY_NOTE =
  'No winner declared.\n\n' +
  'This comparison carries an asymmetry the numbers above do not show: a\n' +
  'substrate familiar from a model\'s training data is being measured against\n' +
  'one being read from a contract file for the first time. A largen win here\n' +
  'is conservative; a largen loss is confounded and needs a few-shot control\n' +
  'before it means anything. Read these as two separate measurements, not a\n' +
  'contest.'

function printOne(r, label) {
  console.log(`  ${label ? `${label}: ` : ''}${r.dir}`)
  console.log(`    files             ${r.files.total} css file(s) — ${r.files.components} component(s), ` +
    `${r.files.skipped.nonComponent} non-component skipped, ${r.files.skipped.minified} minified skipped`)
  console.log('    contract')
  console.log(`      layer                   ${r.contract.counts.layer} error(s)`)
  console.log(`      colour-literal          ${r.contract.counts['colour-literal']} ` +
    `(${r.contract.escapeRates.colourLiteral}/component)`)
  console.log(`      raw-semantic-token      ${r.contract.counts['raw-semantic-token']} ` +
    `(${r.contract.escapeRates.rawSemanticToken}/component)`)
  console.log(`      unregistered-slot       ${r.contract.counts['unregistered-slot']}`)
  console.log(`      tone-contrast-unpaired  ${r.contract.counts['tone-contrast-unpaired']}`)
  console.log(`      important               ${r.contract.counts.important}`)
  console.log('    cascade (checkComponentsApply)')
  if (!r.cascade.ran) {
    console.log(`      NOT RUN — ${r.cascade.reason}`)
  } else {
    console.log(`      entry: ${r.cascade.entry}`)
    console.log(`      declarations reaching paint   ${r.cascade.checked}`)
    console.log(`      never applies                 ${r.cascade.neverApplies}`)
    console.log(`      undecidable from a selector   ${r.cascade.undecidable}`)
  }
  console.log('    axis coverage (genai/matrix.js)')
  if (!r.axisCoverage.available) {
    console.log(`      not available — ${r.axisCoverage.reason}`)
  } else {
    console.log(`      checked        ${r.axisCoverage.checked}`)
    console.log(`      findings       ${r.axisCoverage.findings}`)
    console.log(`      undecidable    ${r.axisCoverage.undecidable}`)
  }
  console.log('    theme survival (genai/probe.js)')
  if (!r.themeSurvival.available) {
    console.log(`      not available — ${r.themeSurvival.reason}`)
  } else {
    console.log(`      probe built — ${r.themeSurvival.selectors} selector(s) x ` +
      `${r.themeSurvival.properties} propert(y/ies) x ${r.themeSurvival.themes} theme(s), ` +
      `${(r.themeSurvival.bytes / 1024).toFixed(1)}kb`)
    console.log(`      ${r.themeSurvival.note}`)
  }
  console.log('    tokens per component')
  console.log(`      ${r.tokens.componentsDetected} component(s) — ${r.tokens.totalSet} set ` +
    `(${r.tokens.avgSetPerComponent ?? '—'} avg), ${r.tokens.totalRead} read ` +
    `(${r.tokens.avgReadPerComponent ?? '—'} avg)`)
  console.log()
}

function toJsonSafe(r) {
  const { themeSurvival, ...rest } = r
  if (!themeSurvival.available) return { ...rest, themeSurvival }
  const { html, ...ts } = themeSurvival
  return { ...rest, themeSurvival: ts }
}

/* --- CLI -------------------------------------------------------------- */

const USAGE = `
  largen eval — score a directory of authored components against the
                authoring contract. Offline, deterministic, no model.

    largen eval ./src/components
    largen eval ./src/components --entry components.css
    largen eval ./candidate-a ./candidate-b --entry-a a.css --entry-b b.css

  Options
    --entry FILE      derive load order for the first (or only) directory
    --entry-a FILE     same, explicit form when two directories are given
    --entry-b FILE     derive load order for the second directory
    --probe-out FILE   write the theme-survival probe for the first directory
    --probe-out-b FILE write it for the second
    --json             machine-readable output

  Given two directories, every metric is reported for both and no winner is
  declared — see the note printed at the end of the report.
`

export async function evalCommand(args = []) {
  const dirs = []
  let entryA = null, entryB = null, probeOutA = null, probeOutB = null, json = false

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    const next = () => args[++i]
    if (a === '--entry' || a === '--entry-a') entryA = next()
    else if (a === '--entry-b') entryB = next()
    else if (a === '--probe-out') probeOutA = next()
    else if (a === '--probe-out-b') probeOutB = next()
    else if (a === '--json') json = true
    else if (a === '--help' || a === '-h') { console.log(USAGE); return 0 }
    else if (a.startsWith('--')) { console.error(`\n  unknown option: ${a}\n${USAGE}`); return 1 }
    else dirs.push(a)
  }

  if (!dirs.length) { console.log(USAGE); return 1 }
  if (dirs.length > 2) { console.error('\n  largen eval takes at most two directories\n'); return 1 }

  const slots = registeredSlots(readFileSync(at('src/properties.css'), 'utf8'))

  let results
  try {
    results = await Promise.all([
      score(dirs[0], { entryArg: entryA, slots }),
      ...(dirs[1] ? [score(dirs[1], { entryArg: entryB, slots })] : []),
    ])
  } catch (e) {
    console.error(`\n  ${e.message}\n`)
    return 1
  }

  if (probeOutA && results[0].themeSurvival.available) writeFileSync(probeOutA, results[0].themeSurvival.html)
  if (probeOutB && results[1]?.themeSurvival.available) writeFileSync(probeOutB, results[1].themeSurvival.html)

  if (json) {
    console.log(JSON.stringify(results.length === 1 ? toJsonSafe(results[0]) : results.map(toJsonSafe), null, 2))
    return 0
  }

  console.log('\n  largen eval\n')
  if (results.length === 1) {
    printOne(results[0])
    console.log(`  ${CONFORMANCE_NOTE.split('\n').join('\n  ')}\n`)
  } else {
    printOne(results[0], 'A')
    printOne(results[1], 'B')
    console.log(`  ${ASYMMETRY_NOTE.split('\n').join('\n  ')}\n`)
  }
  return 0
}

export { evalCommand as eval }
export default evalCommand
