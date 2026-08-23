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
  ['demo-index', '/demo/'],
  ['demo-tests', '/demo/tests.html'],
  ['demo-conformance', '/demo/conformance.html'],
]

for (const [name, path] of PAGES) {
  for (const theme of ['light', 'dark']) {
    const sep = path.includes('?') ? '&' : '?'
    const out = `${OUT}/${name}-${theme}.png`
    await shoot(`${BASE}${path}${sep}theme=${theme}`, out, { height: 1700 })
    console.log(out)
  }
}
