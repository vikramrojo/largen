/* The bake-off harness. No model runs in here.
 *
 * Two agents build the same page from the same brief on different substrates.
 * Everything after that is arithmetic, and it is deliberately separated from the
 * generation so a result can be recomputed without spending a model again.
 *
 * TWO INSTRUMENTS, AND WHY IT IS NOT ONE
 *
 * `largen eval` scores conformance to largen's authoring contract — layer
 * placement, whether declarations reach paint, axis coverage. Pointing it at the
 * Tailwind arm would report zero for all of it, because a Tailwind page has no
 * `@layer largen.components` and no slots. That number would look like a
 * catastrophic loss and would measure nothing at all, which is worse than having
 * no number, because it looks like a result.
 *
 * So `eval` runs on the largen arm only and its output is labelled as
 * substrate-specific. The comparison between arms uses `emit_probe`, which reads
 * getComputedStyle from whatever page it is given and does not care how the values
 * got there. That is the only thing the two substrates genuinely have in common.
 *
 * WHAT THIS DOES NOT DO
 *
 * Declare a winner. `largen eval` refuses to in two-directory mode and the same
 * applies here for a stronger reason, printed with every summary: one arm is handed
 * its substrate's entire contract because that substrate is unknown to the model,
 * and the other needs nothing because it already knows Tailwind.
 *
 *   node .claude/skills/largen-bakeoff/run.mjs <runDir>
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, copyFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname } from 'node:path'
import { join, basename, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const run = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..', '..')
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const PROBE = JSON.parse(readFileSync(join(here, 'probe.json'), 'utf8'))

/* How each substrate is told to change theme. They are not the same lever, and
   pretending they are is how you measure one theme and label it the other —
   the failure largen 0.3.2 was released to fix. */
const THEME_LEVER = {
  largen: { kind: 'attribute', name: 'data-theme' },
  tailwind: { kind: 'class' },
}

/* --- the load order, from the HTML ---------------------------------------- */

/* `largen eval`'s cascade check needs to know which stylesheet loads first, and a
   candidate has no CSS entry point — the HTML links two sheets directly. Without
   this it reports NOT RUN and the most valuable metric silently vanishes.
 *
 * The <link> order IS the load order. Deriving it beats guessing, which is the
 * rule `largen verify` already follows for the same reason. */
async function deriveEntry(dir) {
  /* `linkOrder` lives in genai/layers.js now. This file had the only copy while
     `verify --entry` accepted CSS alone; both take an HTML entry directly today,
     so the copy is gone rather than left to drift. */
  const { linkOrder } = await import(join(repo, 'genai/layers.js'))
  const hrefs = linkOrder(readFileSync(join(dir, 'index.html'), 'utf8'))
  if (!hrefs.length) return null
  writeFileSync(join(dir, '_entry.css'), hrefs.map((h) => `@import url("${h}");`).join('\n') + '\n')
  return { file: '_entry.css', order: hrefs }
}

/* --- rendering ------------------------------------------------------------ */

/** A copy of the page pinned to one theme, by whichever lever the arm uses. */
function themedCopy(dir, arm, theme) {
  const html = readFileSync(join(dir, 'index.html'), 'utf8')
  const lever = THEME_LEVER[arm]
  let out
  if (lever.kind === 'attribute') {
    out = /<html[^>]*\bdata-theme\s*=/i.test(html)
      ? html.replace(/(<html[^>]*\bdata-theme\s*=\s*)["'][^"']*["']/i, `$1"${theme}"`)
      : html.replace(/<html\b/i, `<html data-theme="${theme}"`)
  } else {
    const withoutDark = html.replace(/(<html[^>]*\bclass\s*=\s*["'])([^"']*)(["'])/i,
      (_, a, cls, z) => a + cls.split(/\s+/).filter((c) => c && c !== 'dark').join(' ') + z)
    out = theme === 'dark'
      ? (/<html[^>]*\bclass\s*=/i.test(withoutDark)
        ? withoutDark.replace(/(<html[^>]*\bclass\s*=\s*["'])([^"']*)(["'])/i, (_, a, cls, z) => `${a}${(cls + ' dark').trim()}${z}`)
        : withoutDark.replace(/<html\b/i, '<html class="dark"'))
      : withoutDark
  }
  const file = join(dir, `_${theme}.html`)
  writeFileSync(file, out)
  return file
}

async function shoot(url, out, { width = 1280, height = 1600 } = {}) {
  await run(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars',
    `--screenshot=${out}`, `--window-size=${width},${height}`,
    '--virtual-time-budget=6000', url], { timeout: 120_000 })
  return out
}

/* --- the neutral measurement ---------------------------------------------- */

const unescape = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&')

/* Serve one arm over HTTP, on a port the OS picks.
 *
 * The probe frames the page and reads its computed styles, and a file:// iframe is
 * cross-origin to a file:// parent in Chrome — every file gets its own opaque
 * origin, so contentDocument throws and the probe reports nothing. The first run of
 * this harness did exactly that and returned "0/0 compared", which is why the
 * fixtures exist: a real run would have looked like two substrates that both
 * ignore theming.
 *
 * Screenshots are unaffected and stay on file://; only the probe needs an origin. */
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
}
async function serve(dir) {
  const server = createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'
    if (rel.includes('..')) { res.writeHead(400); return res.end() }
    try {
      const body = readFileSync(join(dir, rel))
      res.writeHead(200, { 'content-type': TYPES[extname(rel)] ?? 'application/octet-stream' })
      res.end(body)
    } catch { res.writeHead(404); res.end('not found') }
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  return { port: server.address().port, close: () => server.close() }
}

async function probeArm(dir, arm) {
  const { buildProbe } = await import(join(repo, 'genai/probe.js'))
  const lever = THEME_LEVER[arm]
  const doc = buildProbe({
    kind: 'computed',
    pages: ['./index.html'],
    selectors: PROBE.selectors,
    properties: PROBE.properties,
    themes: PROBE.themes,
    viewport: PROBE.viewport,
    /* Drive the lever the arm actually reads. A Tailwind page themes by class;
       setting data-theme on it succeeds and changes nothing, which returns the
       page's own theme under the label of the one that was asked for. */
    ...(lever.kind === 'class' ? { themeClass: true } : { themeAttribute: lever.name }),
    timeout: 15_000,
  })
  writeFileSync(join(dir, '_probe.html'), doc)
  const site = await serve(dir)
  try {
    const { stdout } = await run(CHROME, ['--headless', '--disable-gpu',
      '--virtual-time-budget=20000', '--dump-dom', `http://127.0.0.1:${site.port}/_probe.html`],
      { timeout: 180_000, maxBuffer: 64 * 1024 * 1024 })
    const m = stdout.match(/<pre id="json"[^>]*>([\s\S]*?)<\/pre>/)
    if (!m || !m[1].trim()) return { ran: false, error: 'the probe never completed', rows: [] }
    return JSON.parse(unescape(m[1]))
  } finally { site.close() }
}

/* --- substrate-neutral metrics -------------------------------------------- */

/* Files the ARM wrote, excluding anything it merely linked. largen.css is the
   framework and counting it against the largen arm would be measuring the wrong
   thing; Tailwind's CDN build is not on disk at all, so excluding both is the only
   symmetric choice available. */
const FRAMEWORK = new Set(['largen.css', 'theme-dark.css', '_entry.css'])
const GENERATED = /^_(light|dark|probe)\.html$/

function authored(dir) {
  const files = readdirSync(dir).filter((f) => {
    if (FRAMEWORK.has(f) || GENERATED.test(f)) return false
    return /\.(css|html)$/.test(f)
  })
  let bytes = 0
  let literals = 0
  for (const f of files) {
    const text = readFileSync(join(dir, f), 'utf8')
    bytes += Buffer.byteLength(text)
    /* Comments stripped first so a hex in prose is not counted as a decision. */
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '')
    literals += (code.match(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/gi) ?? []).length
  }
  return { files, bytes, colourLiterals: literals }
}

/** Did the rendered values actually change between light and dark? */
function themeSurvival(probe) {
  const byTheme = {}
  for (const row of probe.rows ?? []) {
    if (row.missing || row.themeUnstable) continue
    const theme = row.theme?.requested ?? (row.label.includes('dark') ? 'dark' : 'light')
    ;(byTheme[theme] ??= {})[row.selector] = row.values
  }
  const light = byTheme.light ?? {}
  const dark = byTheme.dark ?? {}
  let compared = 0
  let changed = 0
  const stuck = []
  for (const sel of Object.keys(light)) {
    if (!dark[sel]) continue
    let selChanged = false
    for (const prop of PROBE.properties) {
      if (light[sel][prop] === undefined) continue
      compared++
      if (light[sel][prop] !== dark[sel][prop]) { changed++; selChanged = true }
    }
    if (!selChanged) stuck.push(sel)
  }
  return { compared, changed, stuck }
}

/** Elements that resolved to nothing — the page did not produce a required hook. */
function missingHooks(probe) {
  const missing = new Set()
  for (const row of probe.rows ?? []) if (row.missing) missing.add(row.selector)
  return [...missing]
}

/* --- largen-only conformance ---------------------------------------------- */

async function evalArm(dir, entry) {
  const args = [join(repo, 'skill/scripts/cli.mjs'), 'eval', dir, '--json']
  if (entry) args.push('--entry', entry.file)
  try {
    const { stdout } = await run('node', args, { timeout: 180_000, maxBuffer: 32 * 1024 * 1024 })
    return JSON.parse(stdout)
  } catch (error) {
    return { error: error.message }
  }
}

/* --- run ------------------------------------------------------------------ */

/* Absolute, always.
 *
 * A relative path reached `file://${page}` as `file://.claude/skills/...`, which
 * is not a valid URL. Chrome rendered ERR_INVALID_URL, --screenshot saved that
 * error page, and the run recorded two screenshots and no error — a harness
 * reporting success for something that did not happen, which is the failure it
 * exists to detect. The fixtures passed because /tmp is absolute. */
const runDir = process.argv[2] ? resolve(process.argv[2]) : null
if (!runDir || !existsSync(runDir)) {
  console.error('\n  usage: node run.mjs <runDir>   (containing largen/ and tailwind/)\n')
  process.exit(1)
}

const report = { run: basename(runDir), arms: {}, generatedAt: null }

for (const arm of ['largen', 'tailwind']) {
  const dir = join(runDir, arm)
  if (!existsSync(join(dir, 'index.html'))) {
    report.arms[arm] = { error: 'no index.html — the arm produced nothing to measure' }
    continue
  }

  /* The framework files the arm links and does not author.
   *
   * theme-dark.css is separate from largen.css and is the ONLY place the dark
   * tokens live. The first version of this harness supplied largen.css alone, so
   * the brief's "must work in light and dark" was impossible for that arm — its
   * two screenshots came out byte-identical. That is an unfair packet producing a
   * largen loss, and it would have looked like a finding. */
  if (arm === 'largen') {
    for (const f of ['largen.css', 'theme-dark.css']) {
      if (!existsSync(join(dir, f))) copyFileSync(join(repo, 'dist', f), join(dir, f))
    }
  }

  const entry = arm === 'largen' ? await deriveEntry(dir) : null

  /* Shot over HTTP rather than file://, from the same server the probe uses.
     Not for origin reasons — a screenshot does not need one — but because a URL
     that does not load is then detectable. `--screenshot` photographs whatever
     Chrome renders, including its own error page, and reports no failure. */
  const shots = {}
  const site = await serve(dir)
  try {
    for (const theme of PROBE.themes) {
      const page = basename(themedCopy(dir, arm, theme))
      const url = `http://127.0.0.1:${site.port}/${page}`
      const out = join(dir, `shot-${theme}.png`)
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`${url} returned ${res.status}`)
        await shoot(url, out)
        shots[theme] = { file: `${arm}/shot-${theme}.png`, bytes: statSync(out).size }
      } catch (e) { shots[theme] = { error: e.message } }
    }
  } finally { site.close() }

  const probe = await probeArm(dir, arm)

  report.arms[arm] = {
    authored: authored(dir),
    entry,
    shots,
    probe: {
      ran: probe.ran ?? false,
      error: probe.error ?? null,
      failures: probe.failures ?? null,
      missingHooks: missingHooks(probe),
      themeSurvival: themeSurvival(probe),
    },
    /* Labelled, not compared. See the header. */
    largenConformance: arm === 'largen' ? await evalArm(dir, entry) : 'not applicable — this arm does not use largen',
  }
}

writeFileSync(join(runDir, 'report.json'), JSON.stringify(report, null, 2) + '\n')
writeFileSync(join(runDir, 'summary.md'), renderSummary(report))

console.log(`\n  wrote ${join(runDir, 'summary.md')} and report.json\n`)
for (const [arm, a] of Object.entries(report.arms)) {
  if (a.error) { console.log(`  ${arm.padEnd(9)} ${a.error}`); continue }
  const t = a.probe.themeSurvival
  console.log(`  ${arm.padEnd(9)} ${a.authored.bytes} authored bytes, ${a.authored.colourLiterals} colour literal(s), ` +
    `theme changed ${t.changed}/${t.compared}` +
    (a.probe.missingHooks.length ? `, ${a.probe.missingHooks.length} hook(s) missing` : ''))
}
console.log()

function renderSummary(r) {
  const L = r.arms.largen ?? {}
  const T = r.arms.tailwind ?? {}
  const cell = (a, f) => (a.error ? '—' : f(a))
  const surv = (a) => cell(a, (x) => `${x.probe.themeSurvival.changed} / ${x.probe.themeSurvival.compared}`)

  const out = [
    `# Bake-off — ${r.run}`, '',
    'Two agents, one brief, one model, two substrates. Everything below the first',
    'table was computed without a model.', '',
    '## Compared — both arms, same instrument', '',
    'Measured by `emit_probe`, which reads computed styles from the rendered page.',
    'It is the only instrument that means the same thing on both arms.', '',
    '| | largen | tailwind |', '|---|---|---|',
    `| authored bytes | ${cell(L, (x) => x.authored.bytes)} | ${cell(T, (x) => x.authored.bytes)} |`,
    `| colour literals | ${cell(L, (x) => x.authored.colourLiterals)} | ${cell(T, (x) => x.authored.colourLiterals)} |`,
    `| theme survival (values changed) | ${surv(L)} | ${surv(T)} |`,
    `| required hooks missing | ${cell(L, (x) => x.probe.missingHooks.join(', ') || 'none')} | ${cell(T, (x) => x.probe.missingHooks.join(', ') || 'none')} |`,
    `| screenshots | ${cell(L, (x) => Object.keys(x.shots).join(', '))} | ${cell(T, (x) => Object.keys(x.shots).join(', '))} |`,
    '',
  ]

  const stuckL = L.probe?.themeSurvival?.stuck ?? []
  const stuckT = T.probe?.themeSurvival?.stuck ?? []
  if (stuckL.length || stuckT.length) {
    out.push('**Unchanged between themes.** An element whose every measured property is',
      'identical in light and dark either is deliberately theme-invariant or is not',
      'themed at all, and this cannot tell the difference — look at the screenshots.', '',
      `- largen: ${stuckL.join(', ') || 'none'}`, `- tailwind: ${stuckT.join(', ') || 'none'}`, '')
  }

  out.push('## largen arm only — conformance to its own contract', '',
    'Not a comparison. A Tailwind page has no `@layer largen.components` and no',
    'slots, so scoring it by these rules would report zero for all of them — a',
    'number that looks like a rout and measures nothing.', '')

  const c = L.largenConformance
  if (c && !c.error) {
    out.push('```json', JSON.stringify({
      contract: c.contract?.counts, cascade: c.cascade, axisCoverage: c.axisCoverage,
    }, null, 2), '```', '')
  } else {
    out.push('`largen eval` did not produce a result: ' + (c?.error ?? 'unknown') + '\n')
  }

  out.push('## What this does not establish', '',
    'No winner is declared, and the reason is not politeness.', '',
    'The largen arm was handed `llms-compact.txt` because it had to be — largen is',
    'absent from the training data of every model that will run this. The Tailwind',
    'arm was given nothing, because it already knows Tailwind. So a largen win here',
    'is **conservative**: it was achieved from a cold read of a contract file against',
    'a substrate the model has seen thousands of times. A largen loss is',
    '**confounded**: it could be the substrate, or it could be the unfamiliarity, and',
    'this design cannot separate them. Doing so needs a few-shot or fine-tuned',
    'control arm, which this is not.', '',
    'Conformance is also not appearance. Every number above can be perfect on a page',
    'that looks wrong. That is what the screenshots are for.', '')

  return out.join('\n')
}
