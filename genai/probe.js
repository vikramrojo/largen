/* largen — emit a verification harness the caller runs themselves.
 *
 * WHY THIS SHAPE
 *
 * The obvious tool here is a hosted endpoint that renders CSS and HTML and
 * reports computed styles. It was rejected: a browser engine on a public
 * unauthenticated endpoint accepting arbitrary markup is remote code execution
 * unless sandboxed. The alternative first offered — accept a validated spec
 * instead of markup — addressed the wrong half. It kept the rendering, which is
 * the vulnerability, and dropped the markup, which is the use case. Every
 * question a migration has is about markup that already exists.
 *
 * So invert it. This module builds a document; it never opens one. Nothing here
 * parses CSS, evaluates a selector, or executes a script. Every caller-supplied
 * string is escaped and embedded as data, and the only thing that ever runs it
 * is the caller's own browser against the caller's own build. There is no engine
 * to sandbox because there is no engine.
 *
 * WHAT IT IS FOR
 *
 * Two thirds of the questions this was asked for are cascade arithmetic and are
 * answered by genai/cascade.js without a browser at all. The rest genuinely need
 * one: a scroll mask that only engages once content overflows, a scroll-spy that
 * sets an attribute part-way down, a theme observer that fires on a media query.
 * A static check cannot see those and neither can a screenshot — one reporter's
 * 40-heading fixture existed solely because their real page never overflowed, so
 * every earlier pass had verified nothing while reporting success.
 *
 * The generated document also serves a second purpose that is easy to miss: its
 * computed-value output is the differential test for the static resolver. A
 * resolver checked only against hand-written expectations is checked against the
 * same understanding of the cascade that it encodes, and agreement proves
 * nothing. Checked against this, it is checked against the engine that decides.
 */

/* --- escaping ------------------------------------------------------------- */

/* Text destined for markup. The document is inert to us and live to the caller,
   so this is not our safety boundary — it is theirs, and it is the only one they
   get. */
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/* Data destined for a <script> block. JSON.stringify is not sufficient on its
   own: an HTML parser closes the script at the first `</script` regardless of
   JavaScript string syntax, and U+2028/U+2029 are line terminators to older
   parsers but not to JSON. */
const json = (value) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')

/* --- the runtime that ships inside the document --------------------------- */

/* Written as a string rather than a function that gets stringified, so that what
   is read here is exactly what the caller receives. It is deliberately plain: no
   modules, no build, no dependency, because a harness that needs installing is a
   harness nobody runs. */
const RUNTIME = `
const CFG = window.__largenProbe
const out = { kind: CFG.kind, rows: [], failures: 0, ran: false }
window.__largenProbeResults = out

/* A probe that dies leaves the page reading "running…" forever, which a driver
   with a timeout reports as "no results" and a human reads as "still working".
   Both are the silent-verification failure this tool exists to prevent, so an
   error has to become a visible result. */
const die = (what) => {
  out.ran = true
  out.error = String(what)
  status('probe failed: ' + out.error, 'bad')
}
window.addEventListener('error', (e) => die(e.message + ' @ ' + e.lineno + ':' + e.colno))
window.addEventListener('unhandledrejection', (e) => die(e.reason && e.reason.message || e.reason))

const status = (text, cls) => {
  const el = document.getElementById('status')
  el.textContent = text
  el.className = cls || ''
  /* Also as text in the DOM. A window property is only reachable by a driver
     that can evaluate script; --dump-dom and "view source" cannot. Writing the
     same object into an element makes the probe automatable by the cheapest
     possible harness, which is the one people actually have. */
  document.getElementById('json').textContent = JSON.stringify(out)
  document.documentElement.setAttribute('data-probe', out.ran ? 'done' : 'running')
}

/* Same-origin only, and by construction: the caller serves the page and opens
   this file from the same build. A cross-origin frame throws on contentDocument,
   which is reported rather than swallowed — a probe that silently measures
   nothing is the failure mode this whole tool exists to prevent. */
function load(url) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe')
    frame.setAttribute('title', 'probe target')
    frame.style.cssText = 'width:' + CFG.viewport.width + 'px;height:' + CFG.viewport.height + 'px;border:0;position:absolute;left:-99999px'
    /* A frame that never loads fires neither handler. Without this the probe
       waits forever on a URL that 404s at the network layer or an origin that
       is not up — reported as "no results", read as "still working". */
    const timer = setTimeout(() => reject(new Error('timed out loading ' + url + ' — is it being served?')), CFG.timeout)
    frame.onerror = () => { clearTimeout(timer); reject(new Error('failed to load ' + url)) }
    frame.onload = () => {
      clearTimeout(timer)
      try {
        if (!frame.contentDocument) throw new Error('no access to ' + url + ' — is it same-origin?')
        resolve(frame)
      } catch (e) { reject(e) }
    }
    if (CFG.html) frame.srcdoc = CFG.html
    else frame.src = url
    document.body.appendChild(frame)
  })
}

/* Wait for style and layout to catch up.
 *
 * Double-rAF is the usual idiom and it is not sufficient here. A headless
 * browser producing no frames may never run a rAF callback at all, and this
 * harness is meant to be driven headlessly — that is how its own differential
 * tests consume it. Relying on rAF alone made the probe hang at "running…"
 * forever, which is indistinguishable from a slow page and is exactly the
 * silent non-verification this tool exists to prevent.
 *
 * So: whichever arrives first. Under a virtual clock the timeout fires
 * immediately; in a real browser the rAF pair wins and is the more accurate of
 * the two. Neither can hang. */
const settle = () => new Promise((resolve) => {
  let done = false
  const fin = () => { if (!done) { done = true; resolve() } }
  requestAnimationFrame(() => requestAnimationFrame(fin))
  setTimeout(fin, 50)
})

async function step(doc, s) {
  if (s.wait != null) return new Promise((r) => setTimeout(r, s.wait))
  const el = s.scroll || s.click || s.set
  const node = doc.querySelector(el)
  if (!node) throw new Error('step target not found: ' + el)
  if (s.scroll) {
    const to = s.to === 'end' ? node.scrollHeight : s.to === 'start' ? 0 : Number(s.to) || 0
    node.scrollTop = to
    node.dispatchEvent(new Event('scroll', { bubbles: true }))
  } else if (s.click) {
    node.click()
  } else if (s.set) {
    node.setAttribute(s.attr, s.value)
  }
  await settle()
}

function measure(doc, sel, props, label) {
  const nodes = doc.querySelectorAll(sel)
  if (!nodes.length) {
    /* Absent is a result, not a gap. The reporter's worst case was a harness
       that passed because the elements it asserted on had never rendered. */
    out.rows.push({ label, selector: sel, found: 0, missing: true, values: {} })
    out.failures++
    return
  }
  const cs = getComputedStyle(nodes[0])
  const values = {}
  for (const p of props) values[p] = cs.getPropertyValue(p).trim()
  out.rows.push({ label, selector: sel, found: nodes.length, missing: false, values })
}

function assertOne(doc, a, label) {
  const node = doc.querySelector(a.selector)
  if (!node) {
    out.rows.push({ label, selector: a.selector, assertion: describe(a), got: null, ok: false, why: 'no element matched' })
    out.failures++
    return
  }
  const got = a.attribute
    ? node.getAttribute(a.attribute)
    : getComputedStyle(node).getPropertyValue(a.property).trim()
  let ok = true
  if (a.equals !== undefined) ok = String(got) === String(a.equals)
  else if (a.not !== undefined) ok = String(got) !== String(a.not)
  else if (a.contains !== undefined) ok = String(got ?? '').includes(a.contains)
  if (!ok) out.failures++
  out.rows.push({ label, selector: a.selector, assertion: describe(a), got, ok })
}

const describe = (a) => {
  const what = a.attribute ? '[' + a.attribute + ']' : a.property
  if (a.equals !== undefined) return what + ' == ' + a.equals
  if (a.not !== undefined) return what + ' != ' + a.not
  if (a.contains !== undefined) return what + ' contains ' + a.contains
  return what
}

async function run() {
  try {
    for (const page of CFG.pages) {
      for (const theme of CFG.themes) {
        const frame = await load(page)
        const doc = frame.contentDocument
        if (theme) doc.documentElement.setAttribute('data-theme', theme)
        await settle()
        const label = (CFG.html ? '(inline)' : page) + (theme ? ' · ' + theme : '')
        for (const s of CFG.steps) await step(doc, s)
        for (const sel of CFG.selectors) measure(doc, sel, CFG.properties, label)
        for (const a of CFG.assertions) assertOne(doc, a, label)
        frame.remove()
      }
    }
    out.ran = true
    render()
    status(out.failures ? out.failures + ' failure(s)' : 'all ' + out.rows.length + ' row(s) ok',
      out.failures ? 'bad' : 'good')
  } catch (e) {
    out.ran = true
    out.error = e.message
    status('probe failed: ' + e.message, 'bad')
  }
}

function render() {
  const cell = (v) => { const td = document.createElement('td'); td.textContent = v == null ? '—' : String(v); return td }
  const table = document.createElement('table')
  const head = table.insertRow()
  const cols = CFG.kind === 'interaction'
    ? ['where', 'selector', 'assertion', 'got', '']
    : ['where', 'selector', 'n'].concat(CFG.properties)
  for (const c of cols) { const th = document.createElement('th'); th.textContent = c; head.appendChild(th) }

  for (const r of out.rows) {
    const tr = table.insertRow()
    if (r.ok === false || r.missing) tr.className = 'bad'
    tr.appendChild(cell(r.label))
    tr.appendChild(cell(r.selector))
    if (CFG.kind === 'interaction') {
      tr.appendChild(cell(r.assertion))
      tr.appendChild(cell(r.got))
      tr.appendChild(cell(r.ok === false ? (r.why || 'FAIL') : 'ok'))
    } else {
      tr.appendChild(cell(r.missing ? 'NOT FOUND' : r.found))
      for (const p of CFG.properties) tr.appendChild(cell(r.missing ? '' : r.values[p]))
    }
  }
  document.getElementById('results').appendChild(table)
}

run()
`

/* --- the document --------------------------------------------------------- */

const KINDS = new Set(['computed', 'interaction'])

/**
 * Build a self-contained probe document.
 *
 * @param {object} options
 * @param {'computed'|'interaction'} options.kind
 * @param {string[]} [options.pages]        same-origin URLs in the caller's build
 * @param {string}   [options.html]         an inline fixture instead of a page
 * @param {string[]} [options.selectors]
 * @param {string[]} [options.properties]
 * @param {Array}    [options.steps]
 * @param {Array}    [options.assertions]
 * @param {string[]} [options.themes]       `data-theme` values; [null] for none
 * @param {{width:number,height:number}} [options.viewport]
 * @returns {string} one HTML document
 */
export function buildProbe(options = {}) {
  const {
    kind = 'computed', pages = [], html = null, selectors = [], properties = [],
    steps = [], assertions = [], themes = [null],
    viewport = { width: 1280, height: 900 }, timeout = 10000,
  } = options

  if (!KINDS.has(kind)) throw new Error(`kind must be one of ${[...KINDS].join(', ')}`)
  if (!html && !pages.length) throw new Error('give `pages` (URLs in your build) or `html` (an inline fixture)')
  if (kind === 'computed' && !selectors.length) throw new Error('a computed probe needs `selectors`')
  if (kind === 'computed' && !properties.length) throw new Error('a computed probe needs `properties`')
  if (kind === 'interaction' && !assertions.length) {
    throw new Error('an interaction probe needs `assertions` — steps with nothing asserted verify nothing')
  }

  const cfg = {
    kind,
    pages: html ? ['(inline)'] : pages,
    html,
    selectors,
    properties,
    steps,
    assertions,
    themes: themes.length ? themes : [null],
    viewport,
    timeout,
  }

  const summary = kind === 'computed'
    ? `${selectors.length} selector(s) × ${properties.length} propert(ies) over ${cfg.pages.length} page(s) × ${cfg.themes.length} theme(s)`
    : `${steps.length} step(s), then ${assertions.length} assertion(s) over ${cfg.pages.length} page(s) × ${cfg.themes.length} theme(s)`

  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>largen probe — ${esc(kind)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; margin: 2rem; max-width: 100%; }
  h1 { font-size: 1rem; margin: 0 0 .25rem; }
  p  { margin: 0 0 1rem; color: #555; }
  table { border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #ccc; padding: .25rem .5rem; text-align: left; vertical-align: top; }
  th { background: #f4f4f4; }
  tr.bad td { background: #fff0f0; }
  #status { font-weight: 700; }
  #status.good { color: #0a7a2f; }
  #status.bad  { color: #b00020; }
</style>
<h1>largen probe — ${esc(kind)}</h1>
<p>${esc(summary)}<br>
Serve this file from the same origin as the pages above, then open it.
Results are also on <code>window.__largenProbeResults</code>.</p>
<p id="status">running…</p>
<div id="results"></div>
<pre id="json" hidden></pre>
<script>window.__largenProbe = ${json(cfg)}</script>
<script>${RUNTIME}</script>
</html>
`
}

export default buildProbe
