/* The verification suite.
 *
 * Every assertion here goes over MCP against a running server. Where a claim is
 * "hosted agrees with local", it is checked by running both and comparing, not
 * by trusting that a shared import makes them equal.
 *
 * What this cannot do is see whether anything rendered. That gap is real —
 * twelve static checks once passed while six components were visibly broken —
 * and is covered by screenshot.mjs, not here.
 */
import { readFileSync } from 'node:fs'
import { connect, callTool } from './mcp-client.mjs'
import { safeValidateNode } from '../../genai/validate.js'

let pass = 0, fail = 0
const results = []

const check = (name, fn) => {
  try { const detail = fn(); pass++; results.push(['ok', name, detail ?? '']) }
  catch (e) { fail++; results.push(['FAIL', name, e.message]) }
}
const assert = (c, m) => { if (!c) throw new Error(m) }
const eq = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b),
  `${m}\n          expected ${JSON.stringify(b)}\n          got      ${JSON.stringify(a)}`)

const client = await connect()
const call = (n, a) => callTool(client, n, a)

/* --- 7.1 all six tools respond ------------------------------------------- */

const { tools } = await client.listTools()
check('7.1 six tools advertised with input schemas', () => {
  eq(tools.map((t) => t.name).sort(), [
    'check_component_css', 'get_component_source', 'get_contract',
    'list_components', 'render_spec', 'validate_spec'].sort(), 'tool names')
  for (const t of tools) assert(t.inputSchema?.type === 'object', `${t.name} has no input schema`)
  return `${tools.length} tools`
})

const contract = await call('get_contract', {})
check('7.1 get_contract returns the contract', () => {
  assert(contract.data.slots.fixed.length === 12, 'expected 12 slots')
  assert(contract.data.layers.order.includes('largen.components'), 'no components layer')
  assert(contract.data.rules.every((r) => r.why), 'a rule carries no prose')
  return `${contract.data.rules.length} rules, ${contract.data.failureModes.length} failure modes`
})

const section = await call('get_contract', { section: 'axes' })
check('7.1 get_contract honours `section`', () => {
  eq(Object.keys(section.data).sort(), ['axes', 'version'], 'section response keys')
  return 'axes only'
})

const badSection = await call('get_contract', { section: 'nonsense' })
check('7.1 get_contract rejects an unknown section', () => {
  assert(badSection.isError, 'should be an error')
  return 'rejected'
})

const src = await call('get_component_source', { name: 'card' })
check('7.1 get_component_source returns CSS', () => {
  assert(src.data.css.includes('--bg'), 'no slots in returned CSS')
  return `${src.data.css.split('\n').length} lines from ${src.data.file}`
})

/* --- 4.5 a name from the network never becomes a path -------------------- */

const HOSTILE_NAMES = ['../../package.json', '/etc/passwd', 'card/../../../etc/passwd', '..', 'CARD']
for (const name of HOSTILE_NAMES) {
  const r = await call('get_component_source', { name })
  check(`4.5 hostile name rejected: ${JSON.stringify(name)}`, () => {
    assert(r.isError, 'should have been rejected')
    assert(!JSON.stringify(r.data).includes('"dependencies"'), 'leaked package.json')
    assert(!JSON.stringify(r.data).includes('root:'), 'leaked /etc/passwd')
    return 'rejected against the known list, never a path'
  })
}

/* --- 7.2 hostile validator cases, hosted vs local ------------------------ */

const HOSTILE = [
  ['unknown component', { component: 'entry-card' }],
  ['unknown tone', { component: 'card', tone: 'chartreuse' }],
  ['unknown variant', { component: 'card', variant: 'gradient' }],
  ['unknown size', { component: 'card', size: 'enormous' }],
  ['injected style', { component: 'card', style: 'color:red' }],
  ['injected onclick', { component: 'card', onclick: 'alert(1)' }],
  ['injected className', { component: 'card', className: 'evil' }],
  ['injected dangerouslySetInnerHTML', { component: 'card', dangerouslySetInnerHTML: { __html: '<script>' } }],
  ['disallowed nesting', { component: 'stat', children: [{ component: 'card' }] }],
  ['text is not a string', { component: 'card', text: { toString: 'no' } }],
  ['children is not an array', { component: 'card', children: 'nope' }],
  ['valid spec', { component: 'card', tone: 'info', children: [{ component: 'badge', text: 'hi' }] }],
]

for (const [label, spec] of HOSTILE) {
  const hosted = await call('validate_spec', { spec })
  const local = safeValidateNode(spec)
  check(`7.2 hosted == local: ${label}`, () => {
    eq(hosted.data.ok, local.ok, 'verdicts differ between hosted and local')
    if (!local.ok) eq(hosted.data.errors[0], local.error, 'error messages differ')
    return local.ok ? 'both accept' : `both reject — ${local.error}`
  })
}

/* --- 7.3 check_component_css fixtures ------------------------------------- */

const FIXTURES = [
  ['correct', `@layer largen.components {\n  .notification {\n    --bg: var(--tone-soft);\n    --fg: var(--tone-ink);\n    --pad: .75em 1em;\n  }\n}`, null],
  ['hex literal', `@layer largen.components {\n  .n { --bg: #fee; --pad: 1em }\n}`, 'colour-literal'],
  ['raw --danger', `@layer largen.components {\n  .n { --bg: var(--danger); --pad: 1em }\n}`, 'raw-semantic-token'],
  ['declared unlayered', `.n {\n  --bg: var(--tone-soft);\n  --pad: 1em;\n}`, 'layer'],
  /* Setting `--tone` from a semantic token is how a component picks the tone its
     subtree resolves against — src/algebra.css does exactly this for every
     [data-tone]. An earlier version of the rule read only the value and rejected
     it, so both directions are pinned here. */
  ['--tone from a semantic token is legitimate',
    `@layer largen.components {\n  .n { --tone: var(--danger); --pad: 1em }\n}`, null],
  ['consuming a semantic token is still caught',
    `@layer largen.components {\n  .n { --tone: var(--info); --bg: var(--warning) }\n}`,
    'raw-semantic-token'],
]

for (const [label, css, expected] of FIXTURES) {
  const r = await call('check_component_css', { css })
  check(`7.3 check_component_css: ${label}`, () => {
    if (expected === null) {
      assert(r.data.ok, `expected clean, got ${JSON.stringify(r.data.findings)}`)
      return 'no findings'
    }
    assert(!r.data.ok, 'expected a failure')
    const hit = r.data.findings.find((f) => f.rule === expected)
    assert(hit, `expected rule ${expected}, got ${r.data.findings.map((f) => f.rule).join(', ')}`)
    if (expected === 'layer') {
      assert(/data-variant/.test(hit.why) && /tone/.test(hit.why),
        'the layer finding must explain that variant dies silently while tone and size live')
      return 'reported, and explains the silent-variant failure'
    }
    return `reported ${expected}`
  })
}

/* --- 7.4 a supplied manifest displaces the reference set ------------------ */

const project = JSON.parse(
  readFileSync(new URL('./fixtures/example.manifest.json', import.meta.url), 'utf8'))

const listed = await call('list_components', { components: project })
check('7.4 list_components uses the supplied manifest', () => {
  const names = listed.data.components.map((c) => c.name)
  assert(names.includes('entry-item'), "missing one of the project's components")
  assert(!names.includes('alert'), 'leaked a largen reference component')
  assert(!names.includes('card'), 'leaked a largen reference component')
  eq(listed.data.source, 'supplied manifest', 'source label')
  return `${names.length} project components, no reference components`
})

const fallback = await call('list_components', {})
check('7.4 list_components falls back to the reference set', () => {
  const names = fallback.data.components.map((c) => c.name)
  assert(names.includes('card') && names.includes('alert'), 'reference set missing')
  assert(!names.includes('entry-item'), 'the project set leaked into the fallback')
  return `${names.length} reference components`
})

const projectSpec = await call('validate_spec',
  { spec: { component: 'entry-item' }, components: project })
check('7.4 a project component validates against the project manifest', () => {
  assert(projectSpec.data.ok, `should validate: ${JSON.stringify(projectSpec.data.errors)}`)
  return 'entry-item accepted'
})

const projectSpecNoManifest = await call('validate_spec', { spec: { component: 'entry-item' } })
check('7.4 the same component is rejected without the manifest', () => {
  assert(!projectSpecNoManifest.data.ok, 'should have been rejected')
  return 'entry-item rejected against the reference set'
})

/* --- 4.2 a malformed manifest is an error, never a silent fallback -------- */

const MALFORMED = [
  ['not an object', 'nope'],
  ['no components array', { axes: { tone: { values: [] }, variant: { values: [] }, size: { values: [] } } }],
  ['empty components', { axes: { tone: { values: ['a'] }, variant: { values: ['a'] }, size: { values: ['a'] } }, components: [] }],
  ['bad component name', { axes: { tone: { values: ['a'] }, variant: { values: ['a'] }, size: { values: ['a'] } }, components: [{ name: '../etc/passwd' }] }],
  ['missing axes', { components: [{ name: 'card' }] }],
]

for (const [label, bad] of MALFORMED) {
  const r = await call('list_components', { components: bad })
  check(`4.2 malformed manifest rejected: ${label}`, () => {
    assert(r.isError, 'should be an error')
    assert(/invalid manifest/.test(r.data.error), `unhelpful error: ${r.data.error}`)
    assert(!JSON.stringify(r.data).includes('"alert"'), 'silently fell back to the reference set')
    return r.data.error.slice(0, 60)
  })
}

/* --- render_spec ---------------------------------------------------------- */

const rendered = await call('render_spec', {
  spec: {
    component: 'card', tone: 'info', children: [
      { component: 'stat', children: [
        { component: 'stat-label', text: 'Revenue' },
        { component: 'stat-value', text: '$4,201' }] },
      { component: 'badge', tone: 'success', variant: 'soft', text: 'up 12%' }],
  },
  theme: 'dark',
})
check('4.8 render_spec returns HTML and a URL', () => {
  assert(rendered.data.ok, 'should have rendered')
  assert(rendered.data.html.includes('data-tone="info"'), 'tone missing from HTML')
  assert(/\/play\/[0-9a-f]{16}$/.test(rendered.data.url), `bad url ${rendered.data.url}`)
  return rendered.data.url
})

const invalidRender = await call('render_spec', { spec: { component: 'nope' } })
check('4.8 render_spec refuses to preview an invalid spec', () => {
  assert(!invalidRender.data.ok, 'should have failed')
  assert(invalidRender.data.url === null, 'produced a URL for an invalid spec')
  return 'errors, no URL'
})

const escaped = await call('render_spec', { spec: { component: 'badge', text: '<script>alert(1)</script>' } })
check('4.8 render_spec escapes text', () => {
  assert(!escaped.data.html.includes('<script>'), 'unescaped markup in output')
  assert(escaped.data.html.includes('&lt;script&gt;'), 'text was dropped rather than escaped')
  return 'escaped'
})

/* --- the site holds itself to its own contract --------------------------- */

const siteCss = readFileSync(new URL('../public/site.css', import.meta.url), 'utf8')
const selfCheck = await call('check_component_css', { css: siteCss })
check("the site's own CSS satisfies the contract it documents", () => {
  assert(selfCheck.data.ok,
    'site.css violates largen:\n          ' +
    selfCheck.data.findings.map((f) => `${f.rule}:${f.line} ${f.message}`).join('\n          '))
  return `${siteCss.split('\n').length} lines clean`
})

/* --- the example set holds itself to the contract it demonstrates -------- */

const exampleCss = readFileSync(new URL('../../sites/example/components.css', import.meta.url), 'utf8')
const exampleCheck = await call('check_component_css', { css: exampleCss })
check('the example component set satisfies the contract', () => {
  assert(exampleCheck.data.ok,
    'sites/example violates largen:\n          ' +
    exampleCheck.data.findings.map((f) => `${f.rule}:${f.line} ${f.message}`).join('\n          '))
  return `${exampleCss.split('\n').length} lines clean`
})

/* --- statelessness -------------------------------------------------------- */

const first = await call('list_components', {})
const second = await call('list_components', {})
check('server is stateless — identical calls give identical answers', () => {
  eq(first.data, second.data, 'two identical calls differed')
  return 'deterministic'
})

await client.close()

console.log('\n  largen.dev verification\n')
for (const [status, name, detail] of results) {
  console.log(`  ${status.padEnd(5)} ${name}${detail ? ` — ${detail}` : ''}`)
}
console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
