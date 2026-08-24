/* Re-capture the two reference screens from the live site.
 *
 *   node .claude/skills/largen-bakeoff/target/capture.mjs
 *
 * Why CDP and not `chrome --headless --screenshot`: craift.pages.dev pins its
 * hero and reveals every later section on scroll. A tall `--window-size`
 * capture just repeats the hero, `--disable-javascript` leaves the sections
 * empty, and `--force-prefers-reduced-motion` does not disable the reveal. The
 * only capture that gets the content section is one that actually scrolls, so
 * this drives Chrome over the DevTools protocol and walks the page first.
 *
 * No dependencies: Node's built-in WebSocket speaks CDP directly.
 *
 * The site is a third-party page and may change. These PNGs are the reference
 * of record for the bake-off; re-running this is how you refresh them, and a
 * refresh that moves the target invalidates comparison with earlier runs.
 */
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SITE = 'https://craift.pages.dev/'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=9222', '--hide-scrollbars',
  '--window-size=1280,900', '--force-device-scale-factor=1',
  '--user-data-dir=/tmp/largen-bakeoff-capture', '--no-first-run', 'about:blank',
], { stdio: 'ignore' })

async function debuggerUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:9222/json')).json()
      const page = list.find((t) => t.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch { /* not up yet */ }
    await sleep(250)
  }
  throw new Error('Chrome never opened a debugging port')
}

const ws = new WebSocket(await debuggerUrl())
await new Promise((r) => ws.addEventListener('open', r, { once: true }))

let seq = 0
const pending = new Map()
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
})
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = ++seq
    pending.set(id, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)))
    ws.send(JSON.stringify({ id, method, params }))
  })
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text)
  return r.result.value
}
const shot = async (name, clip) => {
  const r = await send('Page.captureScreenshot', { clip, captureBeyondViewport: true })
  const out = join(HERE, name)
  writeFileSync(out, Buffer.from(r.data, 'base64'))
  console.log(`  ${name.padEnd(24)} ${clip.width}x${clip.height}`)
}

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: SITE })
await sleep(6000)

console.log(`\n  capturing from ${SITE}\n`)

/* Screen 1 — the landing hero, top of page, before anything is scrolled. */
await shot('screen-1-landing.png', { x: 0, y: 0, width: 1280, height: 860, scale: 1 })

/* Walk the whole page so every scroll-triggered reveal has fired, then find
   the section by its copy rather than by a class name the site may rename. */
const height = await evaluate('document.documentElement.scrollHeight')
for (let y = 0; y < height; y += 400) {
  await evaluate(`window.scrollTo({top:${y},behavior:'instant'})`)
  await sleep(180)
}
await sleep(1500)

const rect = await evaluate(`(() => {
  const want = 'Nothing here happened overnight'
  const hits = [...document.querySelectorAll('section,div')].filter((el) => (el.textContent || '').includes(want))
  if (!hits.length) return null
  const el = hits[hits.length - 1].closest('section') || hits[hits.length - 1]
  el.scrollIntoView({ block: 'start', behavior: 'instant' })
  return { top: el.getBoundingClientRect().top + window.scrollY }
})()`)
if (!rect) throw new Error('content section not found — the site copy changed')
await sleep(1200)

/* Screen 2 — the partners strip through the first stat row. The -270 offset
   trims the empty run-up above the eyebrow without clipping it. */
await shot('screen-2-content.png', {
  x: 0, y: Math.max(0, Math.round(rect.top) - 270), width: 1280, height: 1180, scale: 1,
})

console.log('')
ws.close()
chrome.kill()
