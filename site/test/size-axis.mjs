/* The size axis, measured rather than asserted.
 *
 * `--scale` inherits and a component multiplies its `--font-size` by it. Padding
 * in `em` is relative to that font-size and follows it. Padding in `rem` does not,
 * and the failure is invisible: the type grows, the box does not, and the page
 * looks deliberate.
 *
 * This is the evidence behind the `pad-in-rem` lint rule and behind shipping one
 * rem scale for rhythm rather than two scales. It is a test rather than a note
 * because the numbers are the argument, and an argument that nothing re-checks is
 * a claim about a browser that may have moved.
 */
import { writeFileSync, mkdtempSync, rmSync, copyFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { join, extname } from 'node:path'
import { tmpdir } from 'node:os'
import { buildProbe } from '../../genai/probe.js'
import { lintComponentCss, registeredSlots } from '../../genai/lint.js'

const run = promisify(execFile)
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const root = new URL('../../', import.meta.url).pathname
const slots = registeredSlots(readFileSync(join(root, 'src/properties.css'), 'utf8'))

let pass = 0, fail = 0
const check = async (name, fn) => {
  try { const d = await fn(); pass++; console.log(`  ok    ${name}${d ? ` — ${d}` : ''}`) }
  catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`) }
}
const assert = (c, m) => { if (!c) throw new Error(m) }

const dir = mkdtempSync(join(tmpdir(), 'largen-size-axis-'))
copyFileSync(join(root, 'dist/largen.css'), join(dir, 'largen.css'))
writeFileSync(join(dir, 'page.html'), `<!doctype html><html data-theme="light"><head>
<link rel="stylesheet" href="largen.css">
<style>@layer largen.components{
  .em  { --font-size: calc(1rem * var(--scale)); --pad: 0.5em 1em }
  .rem { --font-size: calc(1rem * var(--scale)); --pad: var(--space-2) var(--space-4) }
}</style></head><body>
<div data-size="sm"><span class="em" id="em-sm">a</span><span class="rem" id="rem-sm">b</span></div>
<div data-size="xl"><span class="em" id="em-xl">a</span><span class="rem" id="rem-xl">b</span></div>
</body></html>`)

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8' }
const server = createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'page.html'
  try {
    const body = readFileSync(join(dir, rel))
    res.writeHead(200, { 'content-type': TYPES[extname(rel)] ?? 'application/octet-stream' })
    res.end(body)
  } catch { res.writeHead(404); res.end() }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port

writeFileSync(join(dir, 'probe.html'), buildProbe({
  kind: 'computed', pages: ['./page.html'],
  selectors: ['#em-sm', '#em-xl', '#rem-sm', '#rem-xl'],
  properties: ['padding', 'font-size'], timeout: 10_000,
}))
const { stdout } = await run(CHROME, ['--headless', '--disable-gpu',
  '--virtual-time-budget=10000', '--dump-dom', `http://127.0.0.1:${port}/probe.html`],
  { timeout: 120_000, maxBuffer: 32 * 1024 * 1024 })
server.close()

const un = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&')
const m = stdout.match(/<pre id="json"[^>]*>([\s\S]*?)<\/pre>/)
if (!m || !m[1].trim()) { console.error('\n  the probe never completed\n'); process.exit(1) }
const rows = Object.fromEntries(JSON.parse(un(m[1])).rows.map((r) => [r.selector, r.values]))

await check('the size axis reaches type at both ends', () => {
  assert(rows['#em-sm']['font-size'] !== rows['#em-xl']['font-size'],
    'font-size did not change across data-size — the axis itself is not working')
  return `${rows['#em-sm']['font-size']} → ${rows['#em-xl']['font-size']}`
})

await check('padding in em follows the size axis', () => {
  const sm = rows['#em-sm'].padding, xl = rows['#em-xl'].padding
  assert(sm !== xl, `em padding did not change: ${sm} at sm and xl`)
  return `${sm} → ${xl}`
})

await check('padding in rem does not, which is why the lint rule exists', () => {
  /* Not a defect in largen — it is what rem means. It is a defect in a component
     that wanted its box to grow with its type, and nothing about the rendering
     says so. */
  const sm = rows['#rem-sm'].padding, xl = rows['#rem-xl'].padding
  assert(sm === xl, `rem padding changed (${sm} → ${xl}); the premise of pad-in-rem is wrong`)
  return `${sm} at every size`
})

await check('`pad-in-rem` fires on the rem component and not the em one', () => {
  const warns = (css) => lintComponentCss(css, { slots }).findings.filter((f) => f.rule === 'pad-in-rem').length
  assert(warns('@layer largen.components{.a{--pad:var(--space-2) var(--space-4)}}') === 1, 'did not warn on the rem scale')
  assert(warns('@layer largen.components{.a{--pad:1rem}}') === 1, 'did not warn on a rem literal')
  assert(warns('@layer largen.components{.a{--pad:0.5em 1em}}') === 0, 'warned on correct em padding')
  assert(warns('@layer largen.components{.a{--gap:var(--space-8)}}') === 0, 'warned on --gap, which is legitimately absolute')
  return 'warns on rem padding, silent on em padding and on --gap'
})

rmSync(dir, { recursive: true, force: true })
console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
