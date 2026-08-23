/* Differential test: the static cascade resolver against a real browser.
 *
 * This is the ship gate for genai/cascade.js, and the reason emit_probe was
 * built before the resolver rather than after.
 *
 * A cascade resolver is consulted precisely when the caller's own model of the
 * cascade has already failed. They have no independent check on its answer, so a
 * confidently wrong answer costs more than no tool at all — it would have
 * "explained" the --weight bug with a wrong reason and sent someone off for
 * another afternoon. Testing it against hand-written expectations does not help:
 * those encode the same understanding of the cascade that the resolver encodes,
 * so agreement proves only that one author was consistent with themselves.
 *
 * So every fixture is resolved twice — once statically, once by Chrome — and the
 * two must agree or the resolver must have said "undecidable".
 *
 * The subject element carries `id="subject"` so the probe can find it. No
 * fixture selector uses that id, so it changes no outcome.
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { buildProbe } from '../../genai/probe.js'
import { resolveProperty } from '../../genai/cascade.js'

const run = promisify(execFile)
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = '/tmp/largen-cascade-diff'
const root = new URL('../../', import.meta.url).pathname

const read = (p) => readFileSync(join(root, p), 'utf8')

/* --- fixtures ------------------------------------------------------------- */

const largen = [
  { name: 'reset.css', css: read('src/reset.css') },
  { name: 'tokens.css', css: read('src/tokens.css') },
  { name: 'properties.css', css: read('src/properties.css') },
  { name: 'paint.css', css: read('src/paint.css') },
  { name: 'algebra.css', css: read('src/algebra.css') },
  { name: 'elements.css', css: read('src/elements.css') },
  { name: 'prose.css', css: read('components/prose.css') },
]

const FIXTURES = [
  {
    name: 'the reporter\'s bug: a sublayer outranks the component layer',
    files: [
      { name: 'largen.css', css: '@layer largen.reset, largen.tokens, largen.components;\n@layer largen.components { .prose :where(kbd) { --weight: 500 } }' },
      { name: 'site.css', css: '@layer site.base { * { --weight: 300 } }\n@layer site.overrides { }' },
    ],
    path: [{ tag: 'html' }, { tag: 'body' }, { tag: 'p', classes: ['prose'] }, { tag: 'kbd' }],
    property: '--weight',
  },
  {
    name: 'flat layer names fix it',
    files: [
      { name: 'a.css', css: '@layer site-base, largen.components, site-overrides;\n@layer site-base { * { --weight: 300 } }' },
      { name: 'b.css', css: '@layer largen.components { .prose :where(kbd) { --weight: 500 } }' },
    ],
    path: [{ tag: 'html' }, { tag: 'body' }, { tag: 'p', classes: ['prose'] }, { tag: 'kbd' }],
    property: '--weight',
  },
  {
    name: 'unlayered author CSS beats every layer',
    files: [
      { name: 'a.css', css: '@layer x { .t { --pad: 1rem } }' },
      { name: 'b.css', css: '.t { --pad: 2rem }' },
    ],
    path: [{ tag: 'html' }, { tag: 'body' }, { tag: 'div', classes: ['t'] }],
    property: '--pad',
  },
  {
    name: 'important reverses layer order',
    files: [
      { name: 'a.css', css: '@layer one, two;\n@layer one { .t { --gap: 1px !important } }' },
      { name: 'b.css', css: '@layer two { .t { --gap: 2px !important } }' },
    ],
    path: [{ tag: 'html' }, { tag: 'body' }, { tag: 'div', classes: ['t'] }],
    property: '--gap',
  },
  {
    name: 'specificity decides inside one layer',
    files: [
      { name: 'a.css', css: '@layer one { .t { --gap: 1px } div.t.u { --gap: 2px } :where(.t) { --gap: 9px } }' },
    ],
    path: [{ tag: 'html' }, { tag: 'body' }, { tag: 'div', classes: ['t', 'u'] }],
    property: '--gap',
  },
  {
    name: 'source order decides a tie',
    files: [
      { name: 'a.css', css: '@layer one { .t { --gap: 1px } .t { --gap: 2px } }' },
      { name: 'b.css', css: '@layer one { .t { --gap: 3px } }' },
    ],
    path: [{ tag: 'html' }, { tag: 'body' }, { tag: 'div', classes: ['t'] }],
    property: '--gap',
  },
  {
    name: 'an attribute on an ancestor selects a theme',
    files: [
      { name: 'a.css', css: '@layer one { [data-theme="dark"] .t { --bg: black } .t { --bg: white } }' },
    ],
    path: [{ tag: 'html', attrs: { 'data-theme': 'dark' } }, { tag: 'body' }, { tag: 'div', classes: ['t'] }],
    property: '--bg',
  },
  {
    name: "largen's own stylesheets: --fg on a link inside prose",
    files: largen,
    path: [{ tag: 'html' }, { tag: 'body' }, { tag: 'div', classes: ['prose'] }, { tag: 'p' }, { tag: 'a' }],
    property: '--fg',
  },
  {
    name: "largen's own stylesheets: --line-height on a heading in prose",
    files: largen,
    path: [{ tag: 'html' }, { tag: 'body' }, { tag: 'div', classes: ['prose'] }, { tag: 'h2' }],
    property: '--line-height',
  },
  {
    /* Must come back undecidable, not merely right. A resolver that guesses and
       happens to agree with the browser passes a naive test and is still wrong. */
    name: 'MUST BE UNDECIDABLE: the answer turns on :last-child',
    files: [
      { name: 'a.css', css: '@layer one { .t { --gap: 1px } .t:last-child { --gap: 2px } }' },
    ],
    path: [{ tag: 'html' }, { tag: 'body' }, { tag: 'div', classes: ['t'] }],
    property: '--gap',
    expectUndecidable: true,
  },
  {
    name: 'MUST BE UNDECIDABLE: the answer turns on :hover',
    files: [
      { name: 'a.css', css: '@layer one { .t { --bg: white } .t:hover { --bg: grey } }' },
    ],
    path: [{ tag: 'html' }, { tag: 'body' }, { tag: 'div', classes: ['t'] }],
    property: '--bg',
    expectUndecidable: true,
  },
]

/* --- building the browser's version of a fixture -------------------------- */

const attrs = (n) => Object.entries(n.attrs || {}).map(([k, v]) => ` ${k}="${v}"`).join('')
const classAttr = (n) => (n.classes || []).length ? ` class="${n.classes.join(' ')}"` : ''

/* The chain becomes real nested markup. html and body are not emitted as tags —
   they already exist — so their attributes are set on the real ones. */
function fixtureHtml(path, css) {
  const [root_, body_, ...rest] = path
  let open = '', close = ''
  rest.forEach((n, i) => {
    const last = i === rest.length - 1
    open += `<${n.tag}${classAttr(n)}${attrs(n)}${last ? ' id="subject"' : ''}>`
    close = `</${n.tag}>` + close
  })
  if (!rest.length) throw new Error('a fixture needs at least one element below body')
  return `<!doctype html><html${attrs(root_)}${classAttr(root_)}><head><meta charset="utf-8"><style>${css}</style></head>` +
    `<body${attrs(body_ || {})}${classAttr(body_ || {})}>${open}${close}</body></html>`
}

const unescape = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&')

async function measure(index, fixture, extra = []) {
  const css = fixture.files.map((f) => f.css).join('\n')
  const html = fixtureHtml(fixture.path, css)
  const probe = buildProbe({
    kind: 'computed', html, selectors: ['#subject'],
    properties: [fixture.property, ...extra], timeout: 5000,
  })
  const file = join(OUT, `f${index}.html`)
  writeFileSync(file, probe)
  const { stdout } = await run(CHROME, [
    '--headless', '--disable-gpu', '--virtual-time-budget=6000', '--dump-dom', `file://${file}`,
  ], { timeout: 60_000, maxBuffer: 32 * 1024 * 1024 })
  const m = stdout.match(/<pre id="json"[^>]*>([\s\S]*?)<\/pre>/)
  if (!m || !m[1].trim()) throw new Error('probe produced no results')
  const out = JSON.parse(unescape(m[1]))
  if (out.error) throw new Error(out.error)
  if (!out.rows.length || out.rows[0].missing) throw new Error('#subject not found in the fixture')
  return out.rows[0].values
}

/* --- run ------------------------------------------------------------------ */

mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const norm = (v) => String(v ?? '').trim()

for (const [i, f] of FIXTURES.entries()) {
  let statik, browser, note = ''
  try {
    const r = resolveProperty({ files: f.files, path: f.path, property: f.property })
    statik = r.winner ? norm(r.winner.value) : null

    /* Comparing the static answer to getComputedStyle is comparing two different
       questions whenever the winning value is an expression. The resolver returns
       the declaration as written — deliberately, since reducing calc() and
       substituting var() is a second engine's worth of work — while the browser
       reports the substituted result. `--fg: var(--tone-ink)` against
       `color-mix(in oklab, #16181c 72%, #16181c)` is not a disagreement about
       which declaration won.

       Where the winner is exactly `var(--X)` the indirection is still checkable:
       ask the browser for --X on the same element and the two must be equal. That
       keeps the gate on real stylesheets, where almost every slot is set from a
       token. */
    const indirect = statik && statik.match(/^var\(\s*(--[\w-]+)\s*\)$/)
    const values = await measure(i, f, indirect ? [indirect[1]] : [])
    browser = norm(values[f.property])

    if (f.expectUndecidable) {
      /* The gate is that it SAID so, regardless of whether it guessed right. */
      if (r.undecidable.length) { pass++; console.log(`  ok    ${f.name}\n        undecidable: ${r.undecidable[0].why[0].construct} — ${r.undecidable[0].why[0].reason}`) }
      else { fail++; console.log(`  FAIL  ${f.name}\n        expected an undecidable report, got a confident "${statik}"`) }
      continue
    }

    /* An unset custom property computes to the empty string, which is the same
       answer as "no declaration matched" said a different way. */
    let agree, shown
    if (statik === null) { agree = browser === ''; shown = 'unset in both' }
    else if (indirect) {
      const target = norm(values[indirect[1]])
      agree = browser === target && browser !== ''
      shown = `${statik} → ${browser} (matches ${indirect[1]})`
    } else { agree = statik === browser; shown = statik }

    if (agree) { pass++; console.log(`  ok    ${f.name}\n        ${shown}${r.reason ? `   (${r.reason.split('.')[0]})` : ''}`) }
    else if (r.undecidable.length) {
      pass++
      console.log(`  ok    ${f.name}\n        disagreed (${statik} vs ${browser}) but reported undecidable — allowed`)
    } else {
      fail++
      console.log(`  FAIL  ${f.name}\n        static: ${statik === null ? '(no matching declaration)' : statik}\n        browser: ${JSON.stringify(browser)}\n        and it did not say undecidable`)
    }
  } catch (error) {
    fail++
    console.log(`  FAIL  ${f.name}\n        ${error.message}${note}`)
  }
}

console.log(`\n  ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
