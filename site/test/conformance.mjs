/* Runs demo/conformance.html — the page the documentation points readers at —
 * in headless Chrome and reads its own results, rather than porting its eleven
 * assertions into a second file that has to be kept in step with the first.
 * See openspec/changes/conformance-and-eval/design.md, "Run the page rather
 * than port its assertions". Pattern: site/test/cascade-diff.mjs.
 *
 * The page is served rather than opened as file://, because its
 * <link href="../src/largen.css"> and the @import chain inside that file are
 * relative URLs that only resolve against an http(s) origin — the way the
 * page is actually deployed.
 *
 * Bound to port 0: this repo's other suites run concurrently and 8787 is
 * taken, so the assigned port is read back from the server rather than fixed.
 */
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:http'
import { join, extname, normalize, sep } from 'node:path'

const run = promisify(execFile)
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
/* No trailing slash — safeJoin's `startsWith(base + sep)` check needs exactly
   one separator between base and whatever was joined onto it. */
const root = new URL('../../', import.meta.url).pathname.replace(/\/$/, '')

/* The number of assertions the page SHOULD report, derived the same way
   skill/scripts/pages.mjs:49 derives it — do not invent a second regex for the
   same count. A page that stops reporting all of its checks, or a `check(`
   call quietly deleted, is caught here rather than accepted as "0 of 0
   passed", which is green if only the outcome is checked. */
const SOURCE = readFileSync(join(root, 'demo/conformance.html'), 'utf8')
const EXPECTED = (SOURCE.match(/check\(/g) || []).length

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
}

/* Join a URL path onto the repo root without letting `..` escape it. */
function safeJoin(base, urlPath) {
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '')
  const full = join(base, clean)
  if (full !== base && !full.startsWith(base + sep)) return null
  return full
}

const server = createServer(async (req, res) => {
  const file = safeJoin(root, req.url.split('?')[0])
  try {
    const body = file && await readFile(file)
    if (!body) throw new Error('not found')
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end('not found')
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port

const unescape = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&')

async function readResults() {
  const { stdout } = await run(CHROME, [
    '--headless', '--disable-gpu', '--virtual-time-budget=6000', '--dump-dom',
    `http://127.0.0.1:${port}/demo/conformance.html`,
  ], { timeout: 60_000, maxBuffer: 32 * 1024 * 1024 })
  const m = stdout.match(/<pre id="json"[^>]*>([\s\S]*?)<\/pre>/)
  if (!m || !m[1].trim()) throw new Error('the page produced no machine-readable results')
  return JSON.parse(unescape(m[1]))
}

let out
try {
  out = await readResults()
} catch (error) {
  /* A browser that would not start, crashed, or produced nothing is reported
     as exactly that, never as success — a suite that quietly passes when it
     never executed is the failure this runner exists to prevent. */
  console.log(`  FAIL  conformance did not run: ${error.message}`)
  server.close()
  process.exit(1)
}
server.close()

let fail = 0
for (const r of out.results) {
  if (r.ok) console.log(`  ok    ${r.name}`)
  else { fail++; console.log(`  FAIL  ${r.name}\n        ${r.detail}`) }
}

/* The count check. Catches both a check() silently dropped from the page and
   the page under-reporting what it has — including the "0 of 0" case, since
   EXPECTED is never 0 for this file and a total that fails to match it fails
   here regardless of what passed/failed said. */
if (out.total !== EXPECTED) {
  fail++
  console.log(`  FAIL  the page reported ${out.total} check(s), but its source defines ${EXPECTED} — ` +
    `a page reporting fewer checks than it defines must not pass`)
}

console.log(`\n  ${out.passed}/${out.total} passed (source defines ${EXPECTED} check(s)), ${fail} failure(s)`)
process.exit(fail ? 1 : 0)
