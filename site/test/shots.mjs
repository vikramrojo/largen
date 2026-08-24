/* Screenshot every page in both themes.
 *
 * Not a formality. The library's own history is twelve static checks passing
 * while six components were visibly broken, so every page here gets looked at.
 */
import { shoot } from './screenshot.mjs'

const BASE = process.env.LARGEN_BASE_URL ?? 'http://127.0.0.1:8787'
const OUT = process.env.SHOTS ?? '/tmp/largen-shots'

const PAGES = [
  ['index', '/'],
  ['contract', '/docs/contract.html'],
  ['axes', '/docs/axes.html'],
  ['authoring', '/docs/authoring.html'],
  ['components', '/docs/components.html'],
  ['mcp', '/docs/mcp.html'],
  ['play', '/play'],
  ['migrating', '/docs/migrating.html'],
  ['404', '/nope'],
  /* The demo pages are served from demo/ rather than copied into public/, so
     these also verify that the mount resolves their relative stylesheet links. */
  ['demo-tests', '/demo/tests.html'],
  ['demo-conformance', '/demo/conformance.html'],
]

/* Check every path resolves before shooting any of them.
 *
 * This file writes images and asserts nothing, so a path that stops existing
 * produces a screenshot of a 404 page and no complaint. It listed `/demo/` for
 * three releases after that index page was removed and its cards moved onto the
 * home page — nobody noticed, because the output is a PNG either way.
 *
 * `/nope` is here deliberately: it is the 404 page, so it is the one entry that
 * must NOT resolve. */
const EXPECT_404 = new Set(['/nope'])

const broken = []
for (const [name, path] of PAGES) {
  const res = await fetch(`${BASE}${path}`, { redirect: 'follow' })
  const wanted404 = EXPECT_404.has(path)
  if (wanted404 ? res.status !== 404 : !res.ok) {
    broken.push(`${name} ${path} → ${res.status}${wanted404 ? ' (expected 404)' : ''}`)
  }
}
if (broken.length) {
  console.error(`\n  ${broken.length} page(s) do not resolve — screenshotting them would` +
    ` record a 404 and report success:\n    ${broken.join('\n    ')}\n`)
  process.exit(1)
}

for (const [name, path] of PAGES) {
  for (const theme of ['light', 'dark']) {
    const sep = path.includes('?') ? '&' : '?'
    const out = `${OUT}/${name}-${theme}.png`
    await shoot(`${BASE}${path}${sep}theme=${theme}`, out, { height: 1700 })
    console.log(out)
  }
}
