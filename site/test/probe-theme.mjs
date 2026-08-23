/* Regression: the probe's theme override must survive the page fighting it.
 *
 * Reported from a real migration. `--theme light` returned near-white for two
 * selectors and a correct value for a third, in one run. The mechanism: the probe
 * set data-theme, then awaited settle(), and the page's own theme script ran
 * inside that await and put its theme back. Every reading was then the page's
 * theme wearing the requested theme's label. The third selector looked right only
 * because its colour did not depend on the theme at all — which is what made the
 * failure read as a per-element oddity rather than a broken override.
 *
 * These fixtures run in a real browser, because the bug is a scheduling race and
 * nothing static can see it.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:http'
import { buildProbe } from '../../genai/probe.js'

const run = promisify(execFile)
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = '/tmp/largen-probe-theme'
mkdirSync(OUT, { recursive: true })

/* Themes by ATTRIBUTE, and re-applies its own choice after load. */
const BY_ATTRIBUTE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<script>document.documentElement.dataset.theme = 'dark'</script>
<style>
  :root, [data-theme="light"] { --ink: rgb(22,24,28) }
  [data-theme="dark"]         { --ink: rgb(242,244,246) }
  .themed   { color: var(--ink) }
  .unthemed { color: rgb(1,2,3) }
</style></head><body>
<a class="themed" href="#">a</a><span class="unthemed">b</span>
<script type="module">requestAnimationFrame(() => { document.documentElement.dataset.theme = 'dark' })</script>
</body></html>`

/* Themes by CLASS, as Tailwind does. Setting data-theme here changes nothing. */
const BY_CLASS = `<!doctype html><html lang="en" class="dark"><head><meta charset="utf-8">
<style>
  .light .themed { color: rgb(22,24,28) }
  .dark  .themed { color: rgb(242,244,246) }
</style></head><body><span class="themed">a</span>
<script type="module">requestAnimationFrame(() => { document.documentElement.className = 'dark' })</script>
</body></html>`

/* The probe must be served from the SAME ORIGIN as the pages it frames, or
   contentDocument throws and the probe reports nothing. Serving it from file://
   while the fixtures are on http:// is exactly that mistake. */
const probes = new Map()
const server = createServer((req, res) => {
  const url = req.url.split('?')[0]
  const body = probes.has(url) ? probes.get(url)
    : url.startsWith('/by-class') ? BY_CLASS
    : BY_ATTRIBUTE
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(body)
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port

const unescape = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&')

async function runProbe(name, options) {
  const document = buildProbe({ ...options, timeout: 5000 })
  writeFileSync(`${OUT}/${name}.html`, document)   /* kept for inspection on failure */
  probes.set(`/probe/${name}.html`, document)
  const { stdout } = await run(CHROME, [
    '--headless', '--disable-gpu', '--virtual-time-budget=6000', '--dump-dom',
    `http://127.0.0.1:${port}/probe/${name}.html`,
  ], { timeout: 60_000, maxBuffer: 32 * 1024 * 1024 })
  const m = stdout.match(/<pre id="json"[^>]*>([\s\S]*?)<\/pre>/)
  if (!m || !m[1].trim()) throw new Error('the probe never completed')
  return JSON.parse(unescape(m[1]))
}

let pass = 0, fail = 0
const check = async (name, fn) => {
  try { const d = await fn(); pass++; console.log(`  ok    ${name}${d ? ` — ${d}` : ''}`) }
  catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`) }
}
const assert = (c, m) => { if (!c) throw new Error(m) }

const page = `http://127.0.0.1:${port}/`

await check('the requested theme survives the page re-applying its own', async () => {
  const r = await runProbe('attr', {
    kind: 'computed', pages: [page], selectors: ['.themed'], properties: ['color'],
    themes: ['light', 'dark'],
  })
  assert(r.failures === 0, JSON.stringify(r.rows.map((x) => x.why).filter(Boolean)))
  const light = r.rows.find((x) => x.label.includes('light'))
  const dark = r.rows.find((x) => x.label.includes('dark'))
  assert(light.values.color === 'rgb(22, 24, 28)', `light read ${light.values.color} — the page won the race`)
  assert(dark.values.color === 'rgb(242, 244, 246)', `dark read ${dark.values.color}`)
  return 'light and dark both correct'
})

await check('a theme-independent selector is not mistaken for a working override', async () => {
  /* The reading that made the original report confusing. It must be identical in
     both themes — if a future change makes it differ, the fixture is wrong. */
  const r = await runProbe('attr2', {
    kind: 'computed', pages: [page], selectors: ['.unthemed'], properties: ['color'],
    themes: ['light', 'dark'],
  })
  const values = [...new Set(r.rows.map((x) => x.values.color))]
  assert(values.length === 1, `expected one value across themes, got ${values.join(' / ')}`)
  return `${values[0]} in both — correct by coincidence, which is why it misled`
})

await check('every row records the theme in effect when it was read', async () => {
  const r = await runProbe('attr3', {
    kind: 'computed', pages: [page], selectors: ['.themed'], properties: ['color'], themes: ['light'],
  })
  assert(r.rows[0].theme, 'no theme state recorded')
  assert(r.rows[0].theme['data-theme'] === 'light', `recorded ${r.rows[0].theme['data-theme']}`)
  return 'a reading describes its own conditions'
})

await check('driving the wrong lever fails instead of returning the wrong theme', async () => {
  const r = await runProbe('cls-wrong', {
    kind: 'computed', pages: [`${page}by-class`], selectors: ['.themed'], properties: ['color'],
    themes: ['light'],
  })
  assert(r.failures === 1, 'a class-themed page was measured by attribute without complaint')
  const row = r.rows[0]
  assert(row.themeUnstable, 'not flagged as unstable')
  assert(/themeClass/.test(row.why), `the message does not name the fix: ${row.why}`)
  assert(!Object.keys(row.values).length, 'it reported values it could not vouch for')
  return 'reported, with the fix named'
})

await check('themeClass drives a class-themed page correctly', async () => {
  const r = await runProbe('cls-right', {
    kind: 'computed', pages: [`${page}by-class`], selectors: ['.themed'], properties: ['color'],
    themes: ['light', 'dark'], themeClass: true,
  })
  assert(r.failures === 0, JSON.stringify(r.rows.map((x) => x.why).filter(Boolean)))
  const light = r.rows.find((x) => x.label.includes('light'))
  assert(light.values.color === 'rgb(22, 24, 28)', `light read ${light.values.color}`)
  return 'light and dark both correct'
})

server.close()
console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
