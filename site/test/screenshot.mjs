/* Screenshot pages through headless Chrome.
 *
 * The other half of verification. largen's own history is the argument: twelve
 * static checks passed while six components were visibly broken, so a 200 from a
 * preview URL is evidence that a route exists and nothing more.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const run = promisify(execFile)

const CHROME = process.env.CHROME ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

export async function shoot(url, out, { width = 1280, height = 1400 } = {}) {
  mkdirSync(join(out, '..'), { recursive: true })
  await run(CHROME, [
    '--headless', '--disable-gpu', '--hide-scrollbars',
    `--screenshot=${out}`, `--window-size=${width},${height}`,
    '--virtual-time-budget=2000', url,
  ], { timeout: 60_000 })
  return out
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [url, out] = process.argv.slice(2)
  if (!url || !out) { console.error('usage: screenshot.mjs <url> <out.png>'); process.exit(1) }
  await shoot(url, out)
  console.log(out)
}
