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
    --theme-class                 the page themes by a class on <html>, not an
                                  attribute (Tailwind does this)
    --theme-attribute NAME        the attribute the page themes by
    --config FILE                 a JSON file with any of the above, for
                                  interaction steps and assertions
    --out FILE                    default: largen-probe.html

  A page that manages its own theme will re-apply it after load. The probe pins
  its override against that, and fails rather than reporting numbers if some other
  theme signal on <html> contradicts the one you asked for.

  For "which rule set this property, and why", you do not need this. That is
  cascade arithmetic and \`largen cascade\` answers it without a browser.
`

export async function probe(argv = []) {
  const opts = { pages: [], selectors: [], properties: [], themes: [] }
  let out = 'largen-probe.html'
  let config = null

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

  const document = buildProbe(opts)
  writeFileSync(out, document)

  console.log(`\n  wrote ${out}  (${(document.length / 1024).toFixed(1)}kb, self-contained)`)
  console.log('  Serve it from the build you want to measure, then open it.')
  console.log('  Results: the table, window.__largenProbeResults, and the hidden #json element.\n')
  return 0
}

export default probe
