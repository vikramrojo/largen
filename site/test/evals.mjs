/* Outcome evals: do the tools lead to the fix, or only to an answer?
 *
 * run.mjs asserts shapes — this rule fired, that field is present, the hosted
 * verdict equals the local one. All necessary, and all of it can be true while
 * the answer a caller reads still fails to say the thing that would have fixed
 * their page. The ds-check comparison made the gap concrete: the other server
 * ships an eval harness scoring whether answers are substantively right, and
 * ours had nothing that scored substance.
 *
 * So each scenario here is a page that is actually broken in one of the ways
 * the contract documents, a scripted sequence of tool calls an agent would
 * plausibly make, and a list of things the resulting answers MUST NAME. The
 * scoring is over the text that comes back: not "a finding was returned" but
 * "the finding said `data-variant`". A diagnostic that reports a problem
 * without naming its cause sends the reader back to the same guessing the tool
 * was supposed to end.
 *
 * Two rules keep this honest:
 *
 * 1. Only DIAGNOSTIC answers are scored. It is tempting to include
 *    `get_contract` in the call sequence and score the union, and it would be
 *    meaningless: the contract contains the sentence being looked for, so every
 *    scenario would pass by quoting the documentation back. What is under test
 *    is whether the tools reach the cause from the broken input.
 *
 * 2. Each scenario names the contract failure mode it is seeded from and the
 *    harness checks that mode is still documented. A scenario for a failure the
 *    contract no longer describes is testing a private opinion.
 *
 *   node test/evals.mjs        needs a running server, like run.mjs
 */
import { connect, callTool } from './mcp-client.mjs'
import { buildContract } from '../mcp/contract.mjs'

const client = await connect()
const call = (name, args) => callTool(client, name, args)

const LARGEN_PAINT =
  '@layer largen.paint, largen.components;\n' +
  '@layer largen.paint { * { color: var(--fg, revert-layer); background-color: var(--bg, revert-layer) } }'

const SCENARIOS = [
  {
    id: 'unlayered-component',
    symptom: 'A component is written correctly and `data-variant` does nothing, while ' +
      'tone and size keep working.',
    /* The fragment of the documented cause this scenario is seeded from. */
    anchor: /outside `@layer largen\.components`/,
    async ask() {
      /* What an agent has: the stylesheet it just wrote. */
      const r = await call('check_component_css', {
        css: '.notification {\n  --bg: var(--tone-soft);\n  --fg: var(--tone-ink);\n  --pad: .75em 1em;\n}',
      })
      return [r]
    },
    signals: [
      ['names the layer the component belongs in', /@layer largen\.components/],
      ['names the axis that dies', /data-variant/],
      ['says the other axes go on working', /tone/i],
      ['says the failure is silent rather than an error', /silent|no error|still work/i],
    ],
    forbidden: [['does not call the broken component clean', /"ok":\s*true/]],
  },

  {
    id: 'sublayer-parenting',
    symptom: 'A `--weight: 500` inside `@layer largen.components` computes as 300, and ' +
      'every file involved looks correct on its own.',
    anchor: /sublayer inherits its parent's position/,
    async ask() {
      const files = [
        { name: 'main.css', css: '@import url("largen.css");\n@import url("site.css");' },
        { name: 'largen.css', css: '@layer largen.reset, largen.tokens, largen.components;\n' +
          '@layer largen.components { .prose :where(kbd) { --weight: 500 } }' },
        { name: 'site.css', css: '@layer site.base { * { --weight: 300 } }\n@layer site.overrides { }' },
      ]
      const path = [{ tag: 'html' }, { tag: 'body' }, { tag: 'p', classes: ['prose'] }, { tag: 'kbd' }]
      return [await call('resolve_cascade', { files, entry: 'main.css', path, property: '--weight' })]
    },
    signals: [
      ['names the value that actually wins', /"value":\s*"300"/],
      ['names the layer it came from', /site\.base/],
      ['names layer order as the deciding step', /layer order/i],
      ['names sublayer parenting, the part that looks like nothing', /sublayer/i],
      ['keeps the losing declaration visible rather than reporting no rule', /"value":\s*"500"/],
    ],
    forbidden: [['does not report the authored value as the winner',
      /"winner":\s*\{[^}]*"value":\s*"500"/]],
  },

  {
    id: 'fg-inherit',
    symptom: 'A link component sets `--fg: inherit` to take the surrounding colour and ' +
      'renders browser blue instead.',
    anchor: /currentColor/,
    async ask() {
      const files = [
        { name: 'largen.css', css: LARGEN_PAINT },
        { name: 'site.css', css: '@layer largen.components { :where(.link) { --fg: inherit } }' },
      ]
      const path = [{ tag: 'html' }, { tag: 'body' }, { tag: 'a', classes: ['link'] }]
      return [await call('explain_slot', { files, path, slot: '--fg' })]
    },
    signals: [
      ['says the slot does not apply', /"applies":\s*false/],
      ['names the guaranteed-invalid value it resolves to', /guaranteed-invalid|invalidated/i],
      ['names the mechanism that then fires', /revert-layer/],
      ['says why inherit cannot work here', /inherits:\s*false/],
      ['gives the fix', /currentColor/],
    ],
    forbidden: [['does not report the slot as applying', /"applies":\s*true/]],
  },

  {
    id: 'unlayered-theme',
    symptom: "A project's own token override sits inside `@layer largen.tokens` and the " +
      'theme still wins.',
    anchor: /inside a cascade layer, and largen still wins/,
    async ask() {
      const files = [
        { name: 'theme.css', css: '[data-theme="brand"] { --canvas: #101214; --ink: #f2f4f6 }' },
        { name: 'app.css', css: '@layer largen.tokens { [data-theme="brand"] { --canvas: #ffffff } }' },
      ]
      const path = [{ tag: 'html', attrs: { 'data-theme': 'brand' } }]
      return [await call('resolve_cascade', { files, path, property: '--canvas' })]
    },
    signals: [
      ['names the value that wins', /#101214/],
      ['names the file it came from', /theme\.css/],
      ['says the winner is unlayered', /unlayered/i],
      ['says unlayered CSS outranks every layer', /beats every cascade layer|outranks/i],
      ['keeps the layered override visible rather than dropping it', /largen\.tokens/],
    ],
    forbidden: [['does not report the layered override as the winner',
      /"winner":\s*\{[^}]*"value":\s*"#ffffff"/]],
  },
]

/* --- run ------------------------------------------------------------------ */

const documented = JSON.stringify(buildContract().failureModes)
const rows = []
let scored = 0, possible = 0, failed = 0

for (const s of SCENARIOS) {
  const answers = await s.ask()
  /* Score the text the caller would actually read, whole. A signal found in a
     `note` counts exactly as much as one found in a structured field: the
     question is whether the answer says it, not where. */
  const text = answers.map((a) => JSON.stringify(a.data)).join('\n')

  const hits = s.signals.map(([label, re]) => [label, re.test(text)])
  const violations = (s.forbidden ?? []).filter(([, re]) => re.test(text))
  const anchored = s.anchor.test(documented)

  const got = hits.filter(([, hit]) => hit).length
  scored += got
  possible += s.signals.length
  const ok = anchored && got === s.signals.length && !violations.length
  if (!ok) failed++

  rows.push({ s, hits, violations, anchored, got, ok })
}

await client.close()

console.log('\n  largen.dev outcome evals — do the answers name the cause?\n')
for (const { s, hits, violations, anchored, got, ok } of rows) {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${s.id}  ${got}/${s.signals.length}`)
  console.log(`          ${s.symptom}`)
  if (!anchored) console.log('          ! no longer a documented failure mode — the scenario has drifted')
  for (const [label, hit] of hits) console.log(`          ${hit ? '·' : '✗'} ${label}`)
  for (const [label] of violations) console.log(`          ✗ ${label}`)
  console.log()
}

console.log(`  ${SCENARIOS.length - failed}/${SCENARIOS.length} scenarios, ` +
  `${scored}/${possible} causes named\n`)
process.exit(failed ? 1 : 0)
