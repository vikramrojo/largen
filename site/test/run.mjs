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
import { registeredSlots } from '../../genai/lint.js'

let pass = 0, fail = 0
const results = []

const check = (name, fn, isAsync = false) => {
  if (isAsync) return fn().then(
    (detail) => { pass++; results.push(['ok', name, detail ?? '']) },
    (e) => { fail++; results.push(['FAIL', name, e.message]) })
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
check('7.1 the documented tools are advertised, with input schemas', () => {
  /* Presence, not an exact set. An exact list means adding a tool fails a test
     that is not about additions — which it did. Removing one is the regression
     worth catching, and this still catches it. */
  const names = tools.map((t) => t.name)
  for (const required of ['get_contract', 'list_components', 'get_component_source',
    'validate_spec', 'check_component_css', 'render_spec']) {
    assert(names.includes(required), `${required} is no longer advertised`)
  }
  for (const t of tools) assert(t.inputSchema?.type === 'object', `${t.name} has no input schema`)
  return `${tools.length} tools, all six documented ones present`
})

const contract = await call('get_contract', {})
check('7.1 get_contract returns the contract', () => {
  /* Against the registrations, not a number written here. Hardcoding 12 meant
     adding a slot failed this test instead of the change that broke something. */
  const registered = registeredSlots(readFileSync(new URL('../../src/properties.css', import.meta.url), 'utf8'))
  eq(contract.data.slots.fixed, registered, 'contract slots vs @property registrations')
  assert(contract.data.layers.order.includes('largen.components'), 'no components layer')
  assert(contract.data.rules.every((r) => r.why), 'a rule carries no prose')
  return `${contract.data.rules.length} rules, ${contract.data.failureModes.length} failure modes`
})

const section = await call('get_contract', { section: 'axes' })
check('7.1 get_contract honours `section`', () => {
  const keys = Object.keys(section.data)
  assert(keys.includes('axes'), 'the requested section is missing')
  for (const other of ['rules', 'slots', 'failureModes', 'paint']) {
    assert(!keys.includes(other), `returned ${other} as well as the requested section`)
  }
  return 'axes only, plus version and build metadata'
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

/* --- the tools added from the field report ------------------------------- */

const LARGEN_LAYERS = '@layer largen.reset, largen.tokens, largen.paint, largen.tone, ' +
  'largen.elements, largen.components, largen.modifiers;'

const batch = await call('check_component_css', { files: [
  { name: 'good.css', css: '@layer largen.components{.a{--bg:var(--tone-soft);--pad:1em}}' },
  { name: 'bad.css', css: '@layer largen.components{.b{--bg:#fee;--pad:1em}}' },
  { name: 'unlayered.css', css: '.c{--bg:var(--tone-soft)}' },
] })
check('check_component_css lints several files, attributing each finding', () => {
  eq(batch.data.checked, 3, 'files checked')
  const by = Object.fromEntries(batch.data.results.map((r) => [r.name, r]))
  assert(by['good.css'].ok, 'the clean file was reported dirty')
  assert(by['bad.css'].findings.some((f) => f.rule === 'colour-literal'), 'missed the colour literal')
  assert(by['unlayered.css'].findings.some((f) => f.rule === 'layer'), 'missed the unlayered component')
  return 'per-file, not a merged blob'
})

const single = await call('check_component_css', { css: '@layer largen.components{.a{--pad:1em}}' })
check('check_component_css keeps the single-string form', () => {
  assert(single.data.ok, 'the original signature stopped working')
  return 'callers mid-migration are not broken'
})

for (const [prop, slot] of [['line-height', '--line-height'], ['letter-spacing', '--letter-spacing'],
  ['padding', '--pad'], ['text-transform', null]]) {
  const r = await call('lookup_property', { property: prop })
  check(`lookup_property: ${prop}`, () => {
    eq(r.data.slot, slot, `slot for ${prop}`)
    if (!slot) assert(r.data.note.includes('plain declaration'), 'no guidance for a non-slot')
    return slot ?? 'not a slot, and says what to do instead'
  })
}

const straddle = await call('check_layer_order', { files: [
  { name: 'largen.css', css: LARGEN_LAYERS },
  { name: 'site.css', css: '@layer site.base, largen.components, site.overrides;' },
] })
check('check_layer_order catches sublayers straddling a third layer', () => {
  assert(!straddle.data.ok, 'the straddle was not reported')
  assert(straddle.data.findings.some((f) => f.rule === 'sublayer-straddle'), 'wrong rule')
  /* The resolved order is what explains the symptom: site.base sorting AFTER
     largen.components is why a --weight in the component layer lost. */
  const o = straddle.data.order
  assert(o.indexOf('site.base') > o.indexOf('largen.components'),
    'resolved order does not show site.base sorting later')
  return 'and the resolved order explains why the component layer lost'
})

const preflight = await call('check_layer_order', { files: [
  { name: 'largen.css', css: LARGEN_LAYERS },
  { name: 'tw.css', css: '@layer theme, base, components, utilities;' },
  { name: 'app.css', css: '@layer base, largen.components;' },
] })
check('check_layer_order catches a framework base sorting after largen', () => {
  assert(!preflight.data.ok, 'the preflight ordering was not reported')
  return preflight.data.findings[0].rule
})

const achievable = await call('check_layer_order', { files: [
  { name: 'app.css', css: '@layer app-base, largen.reset, largen.tokens, largen.paint, ' +
    'largen.tone, largen.elements, largen.components, largen.modifiers, app-overrides;' },
  { name: 'largen.css', css: LARGEN_LAYERS },
] })
check('check_layer_order passes on an order that is achievable', () => {
  assert(achievable.data.ok,
    `flagged a valid order: ${JSON.stringify(achievable.data.findings)}`)
  const o = achievable.data.order
  assert(o.indexOf('app-base') < o.indexOf('largen.components'), 'app-base did not sort first')
  assert(o.indexOf('app-overrides') > o.indexOf('largen.modifiers'), 'app-overrides did not sort last')
  return 'a check that only ever fails is not a check'
})

const build = await call('get_build', {})
check('get_build reports checksums for what is served', () => {
  assert(build.data.build, 'no build id')
  for (const [name, e] of Object.entries(build.data.files)) {
    assert(/^[0-9a-f]{64}$/.test(e.sha256), `${name} has no sha256`)
    assert(/^sha384-/.test(e.integrity), `${name} has no integrity string`)
  }
  return `${Object.keys(build.data.files).length} files at ${build.data.build}`
})

check('get_contract carries the build id, since the version does not identify one', () => {
  assert(contract.data.build, 'get_contract returned no build id')
  eq(contract.data.build, build.data.build, 'contract build vs get_build')
  return contract.data.build
})

/* --- the verification tools ---------------------------------------------- */

/* The stylesheets behind the field report's worst bug: a component layer that
   loses to a sublayer of a framework declared afterwards. */
const BUG = [
  { name: 'main.css', css: '@import url("largen.css");\n@import url("site.css");' },
  { name: 'largen.css', css: '@layer largen.reset, largen.tokens, largen.components;\n@layer largen.components { .prose :where(kbd) { --weight: 500 } }' },
  { name: 'site.css', css: '@layer site.base { * { --weight: 300 } }\n@layer site.overrides { }' },
]
const KBD = [{ tag: 'html' }, { tag: 'body' }, { tag: 'p', classes: ['prose'] }, { tag: 'kbd' }]

const cascade = await call('resolve_cascade', { files: BUG, entry: 'main.css', path: KBD, property: '--weight' })
check('resolve_cascade reproduces --weight: 900 computing as 300', () => {
  assert(!cascade.isError, cascade.text)
  eq(cascade.data.winner.value, '300', 'the wrong declaration was reported as winning')
  eq(cascade.data.winner.layer, 'site.base', 'winner came from the wrong layer')
  return `${cascade.data.declarations.length} declarations, winner 300`
})

check('resolve_cascade names sublayer parenting, which is what makes it invisible', () => {
  assert(/layer order/i.test(cascade.data.reason), `reason did not mention layer order: ${cascade.data.reason}`)
  assert(/sublayer/i.test(cascade.data.reason), 'reason did not explain the sublayer rule')
  return cascade.data.reason.slice(0, 48) + '…'
})

check('resolve_cascade wins on specificity when the layer is the same', async () => {
  const r = await call('resolve_cascade', {
    files: [{ name: 'a.css', css: '@layer one { .t { --gap: 1px } div.t.u { --gap: 2px } :where(.t) { --gap: 9px } }' }],
    path: [{ tag: 'div', classes: ['t', 'u'] }], property: '--gap',
  })
  eq(r.data.winner.value, '2px', 'specificity was not applied')
  return 'specificity ' + r.data.winner.specificity.join(',')
}, true)

const undecided = await call('resolve_cascade', {
  files: [{ name: 'a.css', css: '@layer one { .t { --gap: 1px } .t:last-child { --gap: 2px } }' }],
  path: [{ tag: 'div', classes: ['t'] }], property: '--gap',
})
check('resolve_cascade reports what an ancestor chain cannot decide', () => {
  eq(undecided.data.undecidable.length, 1, 'the :last-child rule was not reported as undecidable')
  assert(/sibling position/.test(undecided.data.undecidable[0].why[0].reason), 'no reason given')
  assert(undecided.data.notes.some((n) => /emit_probe/.test(n)), 'did not point at emit_probe')
  return ':last-child — reported, not dropped'
})

check('resolve_cascade does not silently drop the rule it cannot evaluate', () => {
  /* The failure this guards against is the undecidable rule vanishing into
     "no match", which reads as "there is no rule here". */
  const seen = undecided.data.declarations.map((d) => d.selector)
  assert(!seen.includes('.t:last-child'), 'an undecidable rule was ranked as if decided')
  assert(undecided.data.undecidable.some((u) => u.selector === '.t:last-child'), 'the rule disappeared entirely')
  return 'present under `undecidable`, absent from the ranking'
})

const PAINT_FILES = [
  { name: 'l.css', css: '@layer largen.paint, largen.components;\n@layer largen.paint { * { color: var(--fg, revert-layer) } }' },
  { name: 's.css', css: '@layer largen.components { :where(.link) { --fg: inherit } }' },
]
const LINK = [{ tag: 'html' }, { tag: 'body' }, { tag: 'a', classes: ['link'] }]

const inherit = await call('explain_slot', { files: PAINT_FILES, path: LINK, slot: '--fg' })
check('explain_slot catches `--fg: inherit`, which reads as inheriting and is not', () => {
  assert(!inherit.data.applies, 'reported the slot as applying')
  assert(/invalidated/.test(inherit.data.state), `state was ${inherit.data.state}`)
  eq(inherit.data.warnings.length, 1, 'no warning raised')
  assert(/currentColor/.test(inherit.data.warnings[0].fix), 'did not recommend currentColor')
  return inherit.data.warnings[0].message
})

check('explain_slot separates what it derived from what it measured elsewhere', () => {
  assert(inherit.data.revertsTo.illustrative === true, 'the UA value was not flagged illustrative')
  assert(inherit.data.revertsTo.engine, 'the UA value did not name an engine')
  assert(/certain/.test(inherit.data.caveat), 'no caveat separating the two')
  return `${inherit.data.revertsTo.value} — labelled ${inherit.data.revertsTo.engine}`
})

check('explain_slot does not warn on the recipe that works', async () => {
  const r = await call('explain_slot', {
    files: [PAINT_FILES[0], { name: 's.css', css: '@layer largen.components { :where(.link) { --fg: currentColor } }' }],
    path: LINK, slot: '--fg',
  })
  assert(r.data.applies, 'currentColor was not reported as applying')
  eq(r.data.warnings.length, 0, 'warned about a correct declaration')
  return 'no warning — a check that always fires is not a check'
}, true)

check('explain_slot names the un-styling idiom rather than reporting nothing', async () => {
  const r = await call('explain_slot', {
    files: [{ name: 'l.css', css: '@layer largen.paint;\n@layer largen.paint { * { background-color: var(--bg, revert-layer) } }' },
      { name: 's.css', css: '.card { --bg: initial }' }],
    path: [{ tag: 'div', classes: ['card'] }], slot: '--bg',
  })
  assert(/invalidated/.test(r.data.state), `state was ${r.data.state}`)
  assert(r.data.notes.some((n) => /un-styling/.test(n)), 'did not name the idiom')
  return r.data.state
}, true)

const probe = await call('emit_probe', {
  kind: 'computed', pages: ['/'], selectors: ['.badge'], properties: ['line-height'], themes: ['light', 'dark'],
})
check('emit_probe returns a self-contained document', () => {
  assert(!probe.isError, probe.text)
  assert(/^<!doctype html>/i.test(probe.data.document), 'not an HTML document')
  assert(!/<(script|link)[^>]+(src|href)=/.test(probe.data.document), 'the document pulls in something external')
  return `${probe.data.bytes} bytes`
})

check('emit_probe refuses an interaction probe that asserts nothing', async () => {
  const r = await call('emit_probe', { kind: 'interaction', pages: ['/'], steps: [{ click: '.x' }] })
  assert(r.isError, 'accepted steps with no assertions')
  return 'steps with nothing asserted verify nothing'
}, true)

check('emit_probe escapes caller strings into the document', () => {
  const r = probe.data.document
  assert(!r.includes('</script><'), 'a closing script tag survived into the document')
  return 'script-closing sequences neutralised'
})

check('check_layer_order derives load order rather than trusting the given order', async () => {
  const shuffled = [BUG[2], BUG[1], BUG[0]]
  const trusted = await call('check_layer_order', { files: shuffled })
  const derived = await call('check_layer_order', { files: shuffled, entry: 'main.css' })
  assert(JSON.stringify(trusted.data.order) !== JSON.stringify(derived.data.order),
    'deriving the order made no difference, so this proves nothing')
  eq(derived.data.order[derived.data.order.length - 1], 'site.overrides', 'derived order is wrong')
  return `${trusted.data.order[0]} first when trusted, ${derived.data.order[0]} when derived`
}, true)

check('check_layer_order says what it could not resolve', async () => {
  const r = await call('check_layer_order', {
    files: [{ name: 'm.css', css: '@import url("gone.css");\n@layer a { }' }], entry: 'm.css',
  })
  assert(r.data.caveats.some((c) => /gone\.css/.test(c)), 'an unresolved import was not reported')
  return 'unresolved imports reported, not guessed'
}, true)

check('classification does not swallow a component that forgot its layer', async () => {
  /* The near-miss this guards: classifying by "declares inside the components
     layer" alone throws out the unlayered component, which is the one finding
     that matters most. */
  const r = await call('check_component_css', {
    files: [
      { name: 'oops.css', css: '.badge { --bg: var(--tone); --pad: 2px }' },
      { name: 'algebra.css', css: '@layer largen.tone { :where([data-variant="solid"]) { --bg: var(--tone) } }' },
    ],
  })
  const oops = r.data.results.find((x) => x.name === 'oops.css')
  eq(oops.kind, 'component', 'an unlayered component was classified away')
  assert(oops.findings.some((f) => f.rule === 'layer'), 'the missing layer was not reported')
  eq(r.data.results.find((x) => x.name === 'algebra.css').kind, 'not-component',
    "the library's own algebra was judged by component rules")
  return 'unlayered component linted, library algebra skipped'
}, true)

check('a banner does not make a minified bundle look like source', async () => {
  /* The banner added in 0.3.0 put a newline at byte 54, which defeated a
     minified test that looked for the absence of newlines. Every frozen release
     then read as source and was linted as one 9kb line of component CSS. */
  const bundle = '/*! largen 0.0.0+test | MIT */\n' + '@layer largen.components{' + '.a{--bg:#fff}'.repeat(80) + '}'
  const r = await call('check_component_css', { files: [{ name: 'dist.css', css: bundle }] })
  eq(r.data.results[0].kind, 'minified', 'a banner-prefixed bundle was treated as source')
  eq(r.data.results[0].findings.length, 0, 'built output produced findings')
  return 'detected by line length, not by absence of newlines'
}, true)

check('check_component_css classifies a token sheet instead of flooding it', async () => {
  const r = await call('check_component_css', {
    files: [
      { name: 'button.css', css: '@layer largen.components { .btn { --bg: var(--tone) } }' },
      { name: 'theme.css', css: ':root { --canvas: oklch(1 0 0); --ink: oklch(0.2 0 0) }' },
    ],
  })
  eq(r.data.checked, 1, 'linted the wrong number of files')
  eq(r.data.skipped, 1, 'did not skip the token sheet')
  const theme = r.data.results.find((x) => x.name === 'theme.css')
  eq(theme.kind, 'not-component', 'token sheet was misclassified')
  eq(theme.findings.length, 0, 'token sheet produced findings')
  return 'one component linted, one token sheet explained'
}, true)

/* --- the release log ------------------------------------------------------ */

const { checkReleases, renderReleases } = await import('../../skill/scripts/releases.mjs')
const { readFileSync: rf } = await import('node:fs')
const releaseData = JSON.parse(rf(new URL('../../genai/releases.json', import.meta.url), 'utf8')).releases

check('every entry in the release log matches the bytes that version froze', () => {
  const r = checkReleases()
  const errors = r.findings.filter((f) => f.severity === 'error')
  assert(!errors.length, errors.map((f) => `${f.version} ${f.message}`).join('; '))
  assert(r.checked.length >= 2, 'nothing was actually checked')
  return `${r.checked.length} published version(s), ${r.checked.reduce((a, c) => a + c.signals, 0)} signals`
})

check('the release check fails on a claim that was never true', () => {
  /* A check that cannot fail is not a check. Two lies, one in each direction. */
  const lying = JSON.parse(JSON.stringify(releaseData))
  const published = lying.find((r) => r.version === '0.1.0')
  published.signals.present.push('--container-queries')
  published.signals.absent.push('revert-layer')
  const r = checkReleases(lying)
  assert(!r.ok, 'the check passed on two false claims')
  /* Assert the two lies were caught, not that the total error count is two.
     Counting everything makes this fail whenever any OTHER check starts
     reporting — it did, the moment the shipped-code digest was added — and the
     failure says "wrong number of errors" about an assertion that has nothing to
     do with the new one. Same shape as the hardcoded "twelve slots" and "six
     tools" this repo has already been bitten by. */
  const mine = r.findings.filter((f) => f.severity === 'error' && f.version === '0.1.0')
  eq(mine.length, 2, 'the two false claims about 0.1.0 were not both caught')
  assert(mine.some((f) => /--container-queries/.test(f.message)), 'the present-but-absent lie was missed')
  assert(mine.some((f) => /revert-layer/.test(f.message)), 'the absent-but-present lie was missed')
  return 'both directions caught'
})

check('a published version with no entry is an error', () => {
  const r = checkReleases(releaseData.filter((x) => x.version !== '0.1.0'))
  assert(r.findings.some((f) => f.version === '0.1.0' && /no entry/.test(f.message)),
    'a published version vanished from the log without complaint')
  return 'the log cannot silently omit a release'
})

check('the published log is generated, not maintained', () => {
  const onDisk = rf(new URL('../../RELEASES.md', import.meta.url), 'utf8')
  eq(onDisk, renderReleases(), 'RELEASES.md differs from what the generator produces')
  return `${releaseData.length} release(s), regenerated identically`
})

check('the newest entry is the version being shipped', () => {
  const pkg = JSON.parse(rf(new URL('../../package.json', import.meta.url), 'utf8'))
  eq(releaseData[0].version, pkg.version, 'the log and package.json disagree')
  return pkg.version
})

check('what npm ships and what the site pins are the same bytes', () => {
  /* Two distribution channels, one version number. dist/ goes to the registry and
     /v/<version>/ is served by the site; a version whose bytes differ between them
     breaks the one promise a pinned path makes. */
  const r = checkReleases()
  const drift = r.findings.filter((f) => /differs from the frozen/.test(f.message))
  assert(!drift.length, drift.map((f) => f.message).join('; '))
  return 'dist/ matches the frozen release'
})

check('the frozen release matches the checksums it publishes', async () => {
  const { createHash } = await import('node:crypto')
  const pkg = JSON.parse(rf(new URL('../../package.json', import.meta.url), 'utf8'))
  const base = new URL(`../public/v/${pkg.version}/`, import.meta.url)
  const manifest = JSON.parse(rf(new URL('build.json', base), 'utf8'))
  let n = 0
  for (const [name, entry] of Object.entries(manifest.files)) {
    const bytes = rf(new URL(name, base))
    eq(createHash('sha256').update(bytes).digest('hex'), entry.sha256, `${name} sha256`)
    eq(bytes.length, entry.bytes, `${name} byte length`)
    n++
  }
  return `${n} file(s) at /v/${pkg.version}/ verified against their own build.json`
}, true)

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
