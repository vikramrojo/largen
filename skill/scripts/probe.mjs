/* `largen probe` — write a verification harness you run yourself.
 *
 * The same generator the MCP server exposes, for people who are not agents. It
 * writes a file; it does not open one. Serve the file from the build you want to
 * measure and open it in the browsers you care about — which is the point, since
 * the questions this answers are the ones where engines can legitimately differ.
 */
import { writeFileSync } from 'node:fs'
import { buildProbe } from '../../genai/probe.js'

const list = (v) => String(v).split(',').map((s) => s.trim()).filter(Boolean)

const USAGE = `
  largen probe — emit a browser harness for what static checks cannot see

    largen probe --page ./index.html --select .badge --select .btn \\
                 --prop font-weight --prop line-height --theme light --theme dark \\
                 --out probe.html

  Options
    --kind computed|interaction   default: computed
    --page URL                    repeatable; same-origin, relative to the probe
    --html FILE                   an inline fixture instead of --page
    --select SELECTOR             repeatable
    --prop PROPERTY               repeatable
    --theme NAME                  repeatable; sets data-theme
    --theme-storage KEY           the localStorage key the page reads its theme
                                  from. PREFER THIS: the page then applies the
                                  theme itself, completely, rather than having
                                  one of its outputs overridden
    --theme-class                 the page themes by a class on <html>, not an
                                  attribute (Tailwind does this)
    --theme-attribute NAME        the attribute the page themes by
    --config FILE                 a JSON file with any of the above, for
                                  interaction steps and assertions
    --out FILE                    default: largen-probe.html

  A page that manages its own theme applies it through more than one output --
  an attribute, a class, and often the palette written straight onto <html> so
  nothing repaints. Overriding one of those moves one of them. Where the probe can
  tell that the rest did not follow, it refuses to report values rather than
  returning a mix of two themes. Give it --theme-storage and the page does the
  work itself.

  For "which rule set this property, and why", you do not need this. That is
  cascade arithmetic and \`largen cascade\` answers it without a browser.
`

export async function probe(argv = []) {
  const opts = { pages: [], selectors: [], properties: [], themes: [] }
  let out = 'largen-probe.html'
  let config = null
  let sizeAxis = false

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--kind') opts.kind = next()
    else if (a === '--page') opts.pages.push(next())
    else if (a === '--pages') opts.pages.push(...list(next()))
    else if (a === '--select') opts.selectors.push(next())
    else if (a === '--prop') opts.properties.push(next())
    else if (a === '--theme') opts.themes.push(next())
    else if (a === '--themes') opts.themes.push(...list(next()))
    else if (a === '--theme-class') opts.themeClass = true
    else if (a === '--theme-attribute') opts.themeAttribute = next()
    else if (a === '--theme-storage') opts.themeStorage = next()
    else if (a === '--size-axis') sizeAxis = true
    else if (a === '--html') opts.html = (await import('node:fs')).readFileSync(next(), 'utf8')
    else if (a === '--config') config = next()
    else if (a === '--out' || a === '-o') out = next()
    else if (a === '--help' || a === '-h') { console.log(USAGE); return 0 }
    else { console.error(`\n  unknown option: ${a}\n${USAGE}`); return 1 }
  }

  if (config) {
    const { readFileSync } = await import('node:fs')
    const parsed = JSON.parse(readFileSync(config, 'utf8'))
    /* Flags win over the file, so a saved config can be adjusted for one run
       without editing it. */
    for (const [k, v] of Object.entries(parsed)) {
      if (Array.isArray(opts[k]) && opts[k].length) continue
      opts[k] = v
    }
  }

  if (!opts.pages.length && !opts.html && !config) { console.log(USAGE); return 1 }

  if (sizeAxis) {
    const failed = await asSizeAxis(opts)
    if (failed) return failed
  }

  const document = buildProbe(opts)
  writeFileSync(out, document)

  console.log(`\n  wrote ${out}  (${(document.length / 1024).toFixed(1)}kb, self-contained)`)
  console.log('  Serve it from the build you want to measure, then open it.')
  console.log('  Results: the table, window.__largenProbeResults, and the hidden #json element.\n')
  return 0
}

/* Turn a page into a size-axis fixture.
 *
 * Whether padding responds to `data-size` is not in any stylesheet. `--pad` in
 * rem is right on a section and wrong on a button, and the difference is whether
 * the element sits under a `data-size` at runtime. The obvious static narrowing —
 * warn only when the rule also sets `--font-size` — was measured against two real
 * pages and cleared the broken one exactly as readily as the correct one.
 *
 * The page cannot simply be loaded twice with the attribute flipped: the theme
 * loop is the only per-render axis the probe has, and its guards are specific to
 * themes (a page carrying `data-theme="dark"` reads as a conflicting signal the
 * moment the vocabulary is `sm`/`xl`, and the probe correctly refuses to report).
 *
 * So the markup goes into ONE document twice, under two wrappers, and both are
 * measured in a single pass with no theme loop at all. This is the pattern
 * site/test/size-axis.mjs has used since the rule was written.
 */
const SM = '#largen-axis-sm'
const XL = '#largen-axis-xl'

async function asSizeAxis(opts) {
  const { readFileSync } = await import('node:fs')
  const { dirname, resolve } = await import('node:path')

  if (opts.pages.length !== 1) {
    console.error('\n  --size-axis takes exactly one --page: the document to render twice.\n')
    return 1
  }
  const page = opts.pages[0]
  let html
  try { html = readFileSync(page, 'utf8') } catch (e) {
    console.error(`\n  --size-axis cannot read ${page}: ${e.message}\n`)
    return 1
  }

  const body = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)
  if (!body) {
    console.error(`\n  --size-axis found no <body> in ${page}.\n`)
    return 1
  }
  /* The stylesheets come with it. Measuring the markup without the CSS that
     paints it would report every element at its UA padding and call the axis
     dead everywhere. Hrefs are rewritten to the page's own directory so the
     fixture can be served from anywhere. */
  const dir = dirname(resolve(page))
  const links = [...html.matchAll(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi)].map((m) => m[0])

  if (!opts.selectors.length) {
    console.error('\n  --size-axis needs at least one --select: what to measure in both sizes.\n')
    return 1
  }
  /* Every selector is asked twice, scoped to a wrapper. The verdict pass in the
     emitted document pairs them back up by stripping the prefix. */
  const bare = opts.selectors.slice()
  opts.selectors = bare.flatMap((s) => [`${SM} ${s}`, `${XL} ${s}`])

  if (!opts.properties.length) opts.properties = ['padding', 'font-size', 'gap']
  /* No theme loop. The fixture is about size, and running it per theme would
     double every row to say the same thing twice. */
  opts.themes = [null]
  opts.html =
    '<!doctype html><html><head><base href="file://' + dir + '/">' + links.join('') + '</head>' +
    '<body><div id="largen-axis-sm" data-size="sm">' + body[1] + '</div>' +
    '<div id="largen-axis-xl" data-size="xl">' + body[1] + '</div></body></html>'
  opts.pages = []
  opts.sizeAxis = { smPrefix: SM + ' ', xlPrefix: XL + ' ', properties: opts.properties }

  console.log(`\n  size-axis fixture from ${page} — ${bare.length} selector(s), sm vs xl`)
  return 0
}

export default probe
