/* `largen cascade` and `largen slot` — answer "which rule decided this?" from
 * the command line, with no browser.
 *
 * The MCP server exposes the same two functions to agents. This is for the rest
 * of the time: a failing CI check, or a person who has just watched
 * `--weight: 900` compute as `300` and has no idea it is a layer problem.
 *
 * The ancestor chain is written as a selector — `html body p.prose kbd` — which
 * is the shortest notation that already exists for the thing being described. It
 * is parsed with the same compound parser the matcher uses, so what you can write
 * here and what the matcher understands cannot drift apart.
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { resolveProperty, parseCompound, splitCombinators } from '../../genai/cascade.js'
import { explainSlot } from '../../genai/slots.js'
import { root } from './paths.mjs'

const USAGE = `
  largen cascade — which declaration wins, and why

    largen cascade --property --weight --at "html body p.prose kbd" \\
                   --entry src/main.css src/**/*.css

  largen slot — does the paint rule apply this slot, or does it revert?

    largen slot --slot --fg --at "html body a.link" src/**/*.css

  Options
    --property NAME   a slot (--weight) or a plain property (font-weight)
    --slot NAME       a registered slot, for \`largen slot\`
    --at CHAIN        the element's ancestor chain as a selector, outermost first
    --entry FILE      derive load order from this file's @imports rather than argv order
    --json            machine-readable output

  Files are read in the order given, which is taken to be document load order
  unless --entry is passed. That assumption is the one thing this cannot check.
`

/** "html body p.prose kbd" -> ancestor chain nodes. */
export function parseChain(text) {
  const nodes = []
  for (const part of splitCombinators(text)) {
    if (part.type !== 'compound') continue
    const c = parseCompound(part.text)
    const attrs = {}
    for (const a of c.attrs) {
      const m = a.match(/^\s*([\w-]+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]*)))?\s*$/)
      if (m) attrs[m[1]] = m[2] ?? m[3] ?? m[4] ?? ''
    }
    nodes.push({ tag: c.tag, id: c.id, classes: c.classes, attrs })
  }
  if (!nodes.length) throw new Error('--at needs an ancestor chain, e.g. "html body p.prose kbd"')
  return nodes
}

function parseArgs(argv) {
  const opts = { files: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--property') opts.property = argv[++i]
    else if (a === '--slot') opts.slot = argv[++i]
    else if (a === '--at') opts.at = argv[++i]
    else if (a === '--entry') opts.entry = argv[++i]
    else if (a === '--json') opts.json = true
    else if (a === '--help' || a === '-h') opts.help = true
    else if (a.startsWith('--')) throw new Error(`unknown option: ${a}`)
    else opts.files.push(a)
  }
  return opts
}

const load = (paths) => paths.map((p) => ({ name: p, css: readFileSync(p, 'utf8') }))

const spec = (s) => s.join(',')

function report(r) {
  console.log(`\n  ${r.property} — ${r.declarations.length} matching declaration(s)\n`)
  r.declarations.forEach((d, i) => {
    const win = d === r.winner || (r.winner && d.file === r.winner.file && d.order === r.winner.order)
    console.log(`  ${String(i + 1).padStart(2)}. ${(d.layer || '(unlayered)').padEnd(20)} ${d.selector}`)
    console.log(`      ${d.value}${d.important ? ' !important' : ''}   ` +
      `${d.file}:${d.line}  specificity ${spec(d.specificity)}${win ? '   <- WINS' : ''}`)
    if (d.conditions.length) console.log(`      inside ${d.conditions.join(' / ')} — not evaluated`)
  })
  if (r.reason) console.log(`\n  reason: ${r.reason}`)
  if (!r.winner) console.log('\n  Nothing sets it here. A largen slot does not inherit, so nothing arrives that way either.')
  if (r.undecidable.length) {
    console.log(`\n  ${r.undecidable.length} rule(s) could not be decided from an ancestor chain:`)
    for (const u of r.undecidable) {
      console.log(`    ${u.selector}  (${u.file}:${u.line})`)
      console.log(`      ${u.why[0].construct} — ${u.why[0].reason}`)
    }
    console.log('    Any of these could be the rule that wins. Use `largen probe` to settle it.')
  }
  console.log()
}

export async function cascade(argv = []) {
  const opts = parseArgs(argv)
  if (opts.help || (!opts.files.length && !opts.entry)) { console.log(USAGE); return opts.help ? 0 : 1 }
  if (!opts.property) { console.error('\n  --property is required\n'); return 1 }
  if (!opts.at) { console.error('\n  --at is required\n'); return 1 }

  const files = load(opts.files)
  const r = resolveProperty({ files, entry: opts.entry, path: parseChain(opts.at), property: opts.property })
  if (opts.json) { console.log(JSON.stringify(r, null, 2)); return 0 }
  report(r)
  return 0
}

export async function slot(argv = []) {
  const opts = parseArgs(argv)
  if (opts.help || (!opts.files.length && !opts.entry)) { console.log(USAGE); return opts.help ? 0 : 1 }
  if (!opts.slot) { console.error('\n  --slot is required\n'); return 1 }
  if (!opts.at) { console.error('\n  --at is required\n'); return 1 }

  const files = load(opts.files)
  const paintCss = readFileSync(new URL('../../src/paint.css', import.meta.url), 'utf8')
  const r = explainSlot({ files, entry: opts.entry, path: parseChain(opts.at), slot: opts.slot, paintCss })
  if (opts.json) { console.log(JSON.stringify(r, null, 2)); return 0 }

  console.log(`\n  ${r.slot} on <${parseChain(opts.at).pop().tag}>${r.property ? ` — drives \`${r.property}\`` : ''}\n`)
  console.log(`  state       ${r.state}`)
  if (r.setBy) console.log(`  set by      ${r.setBy.layer || '(unlayered)'}  ${r.setBy.selector} { ${r.slot}: ${r.setBy.value} }  ${basename(r.setBy.file)}:${r.setBy.line}`)
  if (r.revertsTo) console.log(`  lands on    ${r.revertsTo.value}   (user agent, measured on ${r.revertsTo.engine} — illustrative)`)
  for (const n of r.notes) console.log(`\n  ${n}`)
  for (const w of r.warnings) {
    console.log(`\n  ⚠ ${w.message}`)
    console.log(`    ${w.why}`)
    console.log(`    ${w.fix}`)
  }
  if (r.caveat) console.log(`\n  ${r.caveat}`)
  console.log()
  return 0
}

export default cascade
