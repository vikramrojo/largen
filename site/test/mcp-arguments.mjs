/* What happens to an out-of-schema argument, measured rather than assumed.
 *
 * The ds-check findings recorded a comparison server answering `limit: "five"`
 * with "no chunks found" — a silent wrong answer, which is the worst error
 * shape there is: the caller gets a confident empty result and no reason to
 * look again. Its schema declared the type; nothing enforced it.
 *
 * Our schemas are declared the same way, so the same question applies to us and
 * the honest answer needed measuring. This script fires the three malformed
 * shapes — a wrong-typed argument, a value outside a declared enum, and a
 * missing required argument — at a representative sample of the tools, and
 * sorts what comes back into three outcomes:
 *
 *   sdk-rejected    the protocol layer refused the call before a handler ran.
 *                   Nothing to add: validating it again here would be a second
 *                   copy of a rule the SDK already enforces.
 *   handler-error   the call reached a handler and came back `isError` with a
 *                   message. Loud, which is the point.
 *   passed-through  the call reached a handler and came back as a normal
 *                   answer. This is the failure mode above, on our endpoint.
 *
 * The exit code is the regression guard: zero when nothing passed through and
 * every rejection names the argument it is about. Before the validator in
 * `guard()` existed this script is what measured the gap; after it, it is what
 * proves the gap stays closed. Both jobs, one script, because a measurement
 * nobody re-runs is a number in a commit message.
 *
 *   node test/mcp-arguments.mjs          against a locally running server
 *   LARGEN_BASE_URL=… node test/…        against a deployed one
 */
import { connect } from './mcp-client.mjs'

const CASES = [
  /* --- out of a declared enum ------------------------------------------- */
  ['enum', 'get_contract', { section: 'nonsense' }, 'section'],
  ['enum', 'render_spec', { spec: { component: 'card' }, theme: 'chartreuse' }, 'theme'],
  ['enum', 'emit_probe', { kind: 'telepathy', pages: ['/'], selectors: ['.x'], properties: ['color'] }, 'kind'],

  /* --- wrong type -------------------------------------------------------- */
  ['type', 'check_component_css', { css: 42 }, 'css'],
  ['type', 'lookup_property', { property: ['line-height'] }, 'property'],
  ['type', 'get_component_source', { name: 42 }, 'name'],
  ['type', 'emit_probe', { pages: '/', selectors: ['.x'], properties: ['color'] }, 'pages'],
  ['type', 'emit_probe', { pages: ['/'], selectors: ['.x'], properties: ['color'], timeout: 'soon' }, 'timeout'],
  ['type', 'emit_probe', { pages: ['/'], selectors: [42], properties: ['color'] }, 'selectors'],
  ['type', 'emit_probe', { pages: ['/'], selectors: ['.x'], properties: ['color'], viewport: { width: 'wide' } }, 'viewport'],
  ['type', 'emit_probe', { pages: ['/'], selectors: ['.x'], properties: ['color'], themeClass: 'yes' }, 'themeClass'],
  ['type', 'check_layer_order', { files: [{ name: 'a.css', css: '@layer a;' }], entry: 42 }, 'entry'],
  ['type', 'resolve_cascade', {
    files: [{ name: 'a.css', css: '@layer a { .t { --gap: 1px } }' }],
    path: [{ tag: 'div', classes: ['t'] }], property: '--gap', viewport: 'wide',
  }, 'viewport'],
  ['type', 'explain_slot', {
    files: [{ name: 'a.css', css: '@layer largen.components { .t { --fg: red } }' }],
    path: [{ tag: 'div', classes: ['t'] }], slot: 42,
  }, 'slot'],
  ['type', 'list_components', { components: 42 }, 'components'],
  ['type', 'validate_spec', { spec: 'a card' }, 'spec'],

  /* --- missing a required argument --------------------------------------- */
  ['required', 'get_component_source', {}, 'name'],
  ['required', 'validate_spec', {}, 'spec'],
  ['required', 'lookup_property', {}, 'property'],
  ['required', 'check_layer_order', {}, 'files'],
  ['required', 'resolve_cascade', {
    files: [{ name: 'a.css', css: '@layer a { .t { --gap: 1px } }' }],
    path: [{ tag: 'div', classes: ['t'] }],
  }, 'property'],
  ['required', 'explain_slot', {
    files: [{ name: 'a.css', css: '@layer a { .t { --fg: red } }' }],
    path: [{ tag: 'div', classes: ['t'] }],
  }, 'slot'],
  ['required', 'render_spec', {}, 'spec'],
]

/* A well-formed call per tool exercised, so "everything errors" cannot be
   mistaken for "the validator works". A check that only ever fails is not a
   check — the same reason the cascade tests pin a passing case. */
const CONTROLS = [
  ['get_contract', { section: 'axes' }],
  ['render_spec', { spec: { component: 'card' }, theme: 'dark' }],
  ['emit_probe', { kind: 'computed', pages: ['/'], selectors: ['.badge'], properties: ['line-height'] }],
  ['check_component_css', { css: '@layer largen.components { .a { --pad: 1em } }' }],
  ['lookup_property', { property: 'line-height' }],
  ['get_component_source', { name: 'card' }],
  ['check_layer_order', { files: [{ name: 'a.css', css: '@layer largen.components;' }] }],
  ['list_components', {}],
  ['validate_spec', { spec: { component: 'card' } }],
  ['resolve_cascade', {
    files: [{ name: 'a.css', css: '@layer a { .t { --gap: 1px } }' }],
    path: [{ tag: 'div', classes: ['t'] }], property: '--gap',
  }],
  ['explain_slot', {
    files: [{ name: 'a.css', css: '@layer largen.paint { * { color: var(--fg, revert-layer) } }' },
      { name: 'b.css', css: '@layer largen.components { .t { --fg: currentColor } }' }],
    path: [{ tag: 'div', classes: ['t'] }], slot: '--fg',
  }],
]

const client = await connect()

async function probe(name, args) {
  try {
    const result = await client.callTool({ name, arguments: args })
    const text = result.content?.[0]?.text ?? ''
    let message = text
    try { message = JSON.parse(text).error ?? text } catch { /* not our JSON envelope */ }
    return {
      outcome: result.isError ? 'handler-error' : 'passed-through',
      message: String(message).replace(/\s+/g, ' ').trim(),
    }
  } catch (e) {
    /* The SDK refused it at the protocol layer: no handler ran. */
    return { outcome: 'sdk-rejected', message: String(e.message).replace(/\s+/g, ' ').trim() }
  }
}

const rows = []
for (const [kind, tool, args, argument] of CASES) {
  const { outcome, message } = await probe(tool, args)
  /* "Names the argument" is the property that makes an error actionable. An
     error result saying only "invalid input" leaves the caller to guess which
     of nine arguments it meant, which on a nine-argument tool is no better than
     the silent answer. */
  const names = new RegExp(`\\b${argument}\\b`).test(message)
  rows.push({ kind, tool, argument, outcome, names, message })
}

const controls = []
for (const [tool, args] of CONTROLS) {
  const { outcome, message } = await probe(tool, args)
  controls.push({ tool, outcome, message })
}

await client.close()

/* --- report --------------------------------------------------------------- */

const LABEL = {
  'sdk-rejected': 'SDK rejected',
  'handler-error': 'handler error',
  'passed-through': 'PASSED THROUGH',
}

console.log('\n  out-of-schema arguments, measured against the running server\n')
const w = (list, f) => Math.max(...list.map((r) => f(r).length))
const tw = w(rows, (r) => r.tool), aw = w(rows, (r) => r.argument)
let last = null
for (const r of rows) {
  if (r.kind !== last) { console.log(`  ${r.kind}`); last = r.kind }
  const flag = r.outcome === 'passed-through' ? '  ' : r.names ? 'ok' : '? '
  console.log(`    ${flag} ${r.tool.padEnd(tw)}  ${r.argument.padEnd(aw)}  ` +
    `${LABEL[r.outcome].padEnd(14)} ${r.names ? 'names it ' : 'unnamed  '} ${r.message.slice(0, 68)}`)
}

const tally = (o) => rows.filter((r) => r.outcome === o).length
console.log(`\n  ${rows.length} malformed calls: ` +
  `${tally('sdk-rejected')} rejected by the SDK, ` +
  `${tally('handler-error')} error results from a handler, ` +
  `${tally('passed-through')} answered normally.`)

const degraded = rows.filter((r) => r.outcome === 'passed-through')
const unnamed = rows.filter((r) => r.outcome !== 'passed-through' && !r.names)
const brokenControls = controls.filter((c) => c.outcome !== 'passed-through')

console.log(`  ${controls.length} well-formed control calls: ` +
  `${controls.length - brokenControls.length} answered, ${brokenControls.length} refused.`)

if (degraded.length) {
  console.log('\n  answered normally — the schema says these are invalid:')
  for (const r of degraded) console.log(`    ${r.tool} ${r.argument}`)
}
if (unnamed.length) {
  console.log('\n  refused, but the message does not name the argument:')
  for (const r of unnamed) console.log(`    ${r.tool} ${r.argument} — ${r.message.slice(0, 80)}`)
}
if (brokenControls.length) {
  console.log('\n  VALID calls refused — the validator is over-tight:')
  for (const c of brokenControls) console.log(`    ${c.tool} — ${c.message.slice(0, 80)}`)
}

const bad = degraded.length + unnamed.length + brokenControls.length
console.log(bad
  ? `\n  ${bad} gap(s). An out-of-schema call must return an error naming the argument.\n`
  : '\n  No silent degradation: every malformed call returns an error naming the argument,\n' +
    '  and every well-formed call still answers.\n')
process.exit(bad ? 1 : 0)
