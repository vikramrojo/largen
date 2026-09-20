/* `largen theme` — a DTCG token document in, a theme stylesheet out.
 *
 * The validation is the point. A theme is the one file a project writes that
 * the algebra cannot check for it: a tone missing its `-on` half, a `--space-*`
 * that slipped into px, an extra named `--pad` that the universal paint rule
 * then reads on every element. All three are silent at runtime and all three
 * are structural in the document, so they are caught here, by name, before
 * anything is written.
 *
 * Nothing is emitted when anything failed. A half-written theme is worse than
 * no theme: the missing half falls back to the defaults and the result is a
 * light tone on a dark canvas, which looks like a design decision.
 *
 * The rules and the codecs live in genai/tokens.js, which is string-only
 * because the MCP server imports it and a server receiving documents over the
 * wire has no filesystem. This file is the filesystem half: arguments, reads,
 * writes, exit codes.
 *
 * Human output goes to stderr and the stylesheet to stdout, without exception,
 * so `largen theme brand.tokens.json > brand.theme.css` writes CSS and nothing
 * else even when the document warns.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { at } from './paths.mjs'
import { registeredSlots } from '../../genai/lint.js'
import { DTCG_VERSION, fromDtcg, toThemeCss } from '../../genai/tokens.js'

const USAGE = `
  largen theme — validate a DTCG token document and emit a theme stylesheet

    largen theme brand.tokens.json
    largen theme brand.tokens.json --out themes/brand.css
    largen theme dark.tokens.json --scheme-media --out themes/dark.css

  Options
    --out FILE        write here instead of stdout
    --theme NAME      the [data-theme] selector; overrides the document's own
    --scheme-media    also emit the prefers-color-scheme block, so a dark
                      document is written once and not twice
    --unlayered       no @layer wrapper. An unlayered theme outranks every
                      layer, which is sometimes what a consumer wants and is
                      always worth saying out loud
    --strict          treat warnings as errors

  The document names its theme and colour scheme in
  \`$extensions["dev.largen"]\`; --theme overrides the name. Errors are
  structural — a tone with one half, a space token that is not in rem, a
  reference that does not resolve, an extra that flattens onto a registered
  slot — and on any of them nothing is written.

  CSS is the source of truth for largen's own tokens; this reads the other
  direction, for a project that authors in a token tool.
`

export async function theme(args = []) {
  if (args.includes('--help') || args.includes('-h')) { console.error(USAGE); return 0 }

  const opts = { out: null, theme: null, schemeMedia: false, layered: true, strict: false }
  const files = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--out' || a === '--theme') {
      /* A flag whose value is missing silently becomes "print to stdout" or
         "take the document's name", which is the wrong kind of quiet. */
      const value = args[++i]
      if (!value || value.startsWith('-')) { console.error(`\n  ${a} needs a value\n`); return 1 }
      opts[a === '--out' ? 'out' : 'theme'] = value
    }
    else if (a === '--scheme-media') opts.schemeMedia = true
    else if (a === '--unlayered') opts.layered = false
    else if (a === '--strict') opts.strict = true
    else if (a.startsWith('-')) { console.error(`\n  unknown option: ${a}\n${USAGE}`); return 1 }
    else files.push(a)
  }

  if (files.length !== 1) {
    console.error(files.length ? '\n  one document at a time.\n' + USAGE : USAGE)
    return 1
  }
  const file = files[0]
  if (!existsSync(file)) { console.error(`\n  no such file: ${file}\n`); return 1 }

  let doc
  try {
    doc = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    console.error(`\n  error ${file} — not JSON: ${e.message}\n`)
    return 1
  }

  /* The slot list is read here and passed in, so the validator stays
     string-only. Outside a package that ships src/ there is no list to check
     against, and saying the check did not run beats running it against an
     empty list and reporting a clean document. */
  const propertiesCss = at('src/properties.css')
  const slots = existsSync(propertiesCss) ? registeredSlots(readFileSync(propertiesCss, 'utf8')) : null
  if (!slots) console.error('\n  note  src/properties.css not found — the slot-collision check did not run')

  const result = fromDtcg(doc, { slots: slots ?? [] })
  const warnings = [...(result.warnings ?? [])]
  const errors = [...(result.errors ?? [])]

  /* The media block is keyed to the colour scheme — there is no
     `prefers-color-scheme: <nothing>` — so a document without one silently
     gets a single selector back from a flag that asked for two. Say so. */
  if (opts.schemeMedia && !result.colorScheme) {
    warnings.push({
      path: '$extensions["dev.largen"].colorScheme',
      message: '--scheme-media needs a colour scheme and the document names none, ' +
        'so no prefers-color-scheme block was emitted. Set it to "dark" or "light".',
    })
  }

  if (warnings.length || errors.length) console.error('')
  for (const w of warnings) console.error(`  warn  ${w.path} — ${w.message}`)
  for (const e of errors) console.error(`  error ${e.path} — ${e.message}`)

  const name = opts.theme ?? result.theme
  if (!name) {
    console.error(`  error no theme name: pass --theme <name> or set $extensions["dev.largen"].theme`)
    errors.push({ path: '$extensions', message: 'no theme name' })
  }

  if (errors.length || (opts.strict && warnings.length)) {
    const why = errors.length
      ? `${errors.length} error${errors.length === 1 ? '' : 's'}`
      : `${warnings.length} warning${warnings.length === 1 ? '' : 's'} under --strict`
    console.error(`\n  ${why} — nothing written.\n`)
    return 1
  }

  const { version } = JSON.parse(readFileSync(at('package.json'), 'utf8'))
  const header =
    `/* GENERATED by \`largen theme ${args.join(' ')}\`. Do not edit.\n` +
    `   largen ${version} · DTCG ${DTCG_VERSION} · ${opts.layered ? 'layered' : 'unlayered'} */`

  const css = toThemeCss(result.tokens, {
    theme: name,
    colorScheme: result.colorScheme,
    layered: opts.layered,
    schemeMedia: opts.schemeMedia,
    header,
  })

  if (opts.out) {
    writeFileSync(opts.out, css)
    console.error(`\n  ${opts.out} — ${result.tokens.size} token${result.tokens.size === 1 ? '' : 's'}` +
      `, [data-theme="${name}"]${warnings.length ? `, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : ''}\n`)
  } else {
    process.stdout.write(css)
  }
  return 0
}
