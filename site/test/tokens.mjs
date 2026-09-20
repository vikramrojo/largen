/* The DTCG token layer, checked against the two stylesheets it has to reproduce.
 *
 * The claim `genai/tokens.js` makes is narrow and total: a token document is the
 * same information as the CSS, so exporting `src/tokens.css` and importing the
 * result gives back `src/tokens.css` — name for name, value for value, in order.
 * A codec that rounds 0.0863 back to `#16181d`, an emitter that writes `0rem`
 * where a person wrote `0`, a parser that loses `var(--shade)` inside a shadow:
 * each is invisible in a diff of the JSON and fatal to the claim. So the round
 * trip is asserted on the real files rather than on a fixture that was written
 * to pass.
 *
 * The other half is the validator, and a validator is only worth as much as its
 * precision. Every diagnostic below is asserted to be the ONLY diagnostic its
 * document produces — a rule that fires alongside three others it did not mean
 * to fire tells a consumer nothing about which line to fix.
 *
 *   node site/test/tokens.mjs
 */
import { readFileSync } from 'node:fs'
import {
  DTCG_VERSION, VOCABULARY, DERIVED_NAMES,
  parseTokensCss, toDtcg, fromDtcg, toThemeCss,
} from '../../genai/tokens.js'
import { registeredSlots } from '../../genai/lint.js'

const root = new URL('../../', import.meta.url).pathname
const slots = registeredSlots(readFileSync(root + 'src/properties.css', 'utf8'))

let pass = 0, fail = 0
const check = (name, fn) => {
  try { const d = fn(); pass++; console.log(`  ok    ${name}${d ? ` — ${d}` : ''}`) }
  catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`) }
}
const assert = (c, m) => { if (!c) throw new Error(m) }
const eq = (a, b, m) => assert(a === b, `${m}\n          expected ${JSON.stringify(b)}\n          got      ${JSON.stringify(a)}`)

/** A document built inline, imported with the real slot list. */
const load = (doc) => fromDtcg(doc, { slots })

/** A document from site/test/fixtures/tokens/, imported the same way. */
const fixture = (name) =>
  JSON.parse(readFileSync(`${root}site/test/fixtures/tokens/${name}.tokens.json`, 'utf8'))

/**
 * Assert that a document produces exactly the diagnostics asked for and no
 * others. `paths` is one path per expected diagnostic, in order.
 */
function only(doc, kind, paths, pattern) {
  const want = [].concat(paths)
  const r = load(doc)
  const other = kind === 'errors' ? 'warnings' : 'errors'
  assert(r[other].length === 0,
    `expected no ${other}, got ${JSON.stringify(r[other])}`)
  assert(r[kind].length === want.length,
    `expected ${want.length} ${kind}, got ${r[kind].length}: ${JSON.stringify(r[kind])}`)
  r[kind].forEach((d, i) => {
    eq(d.path, want[i], 'the diagnostic names the wrong path')
    assert(pattern.test(d.message), `message does not match ${pattern}: ${d.message}`)
  })
  return r
}

const colour = (hex) => ({ colorSpace: 'srgb', components: [...hex.slice(1).match(/../g)].map((h) => parseInt(h, 16) / 255), hex })

console.log('\n  DTCG token layer\n')

/* --- The vocabulary ------------------------------------------------------- */

check('the vocabulary covers src/tokens.css exactly, in both directions', () => {
  const inCss = [...parseTokensCss(readFileSync(root + 'src/tokens.css', 'utf8')).tokens.keys()]
  const inTable = VOCABULARY.map((e) => e.prop)
  const missing = inCss.filter((p) => !inTable.includes(p))
  const extra = inTable.filter((p) => !inCss.includes(p))
  assert(missing.length === 0, `the table does not name ${missing.join(', ')}`)
  assert(extra.length === 0, `the table names ${extra.join(', ')}, which src/tokens.css does not set`)
  /* Order is load-bearing: an imported document emits in table order, so the
     table drifting out of file order would break the round trip silently. */
  eq(JSON.stringify(inTable), JSON.stringify(inCss), 'the table is not in src/tokens.css order')
  return `${inTable.length} tokens`
})

check('the parser reads the layer, the selector, color-scheme and the references', () => {
  const p = parseTokensCss(readFileSync(root + 'src/tokens.css', 'utf8'))
  eq(p.selector, ':root', 'wrong selector')
  eq(p.colorScheme, 'light', 'wrong colour scheme')
  assert(!p.tokens.has('color-scheme'), 'color-scheme leaked into the token map')
  eq(p.tokens.get('--tone'), 'var(--neutral)', '--tone lost its reference')
  eq(p.tokens.get('--lift-1'), '0 1px 2px var(--shade)', '--lift-1 lost its reference')

  const d = parseTokensCss(readFileSync(root + 'themes/dark.css', 'utf8'))
  eq(d.selector, '[data-theme="dark"]', 'wrong theme selector')
  eq(d.colorScheme, 'dark', 'wrong colour scheme')
  eq(d.tokens.size, 35, 'wrong number of declarations')
  return `${p.tokens.size} defaults, ${d.tokens.size} dark overrides`
})

/* --- The codecs, one value at a time -------------------------------------- */

check('every value in src/tokens.css and themes/dark.css survives its codec', () => {
  let n = 0
  for (const file of ['src/tokens.css', 'themes/dark.css']) {
    const { tokens } = parseTokensCss(readFileSync(root + file, 'utf8'))
    for (const [prop, raw] of tokens) {
      /* One token at a time, so a failure names the codec rather than the file.
         A tone member drags its partner along: half a tone is a validation
         error by design, and that rule is asserted on its own below. */
      const entry = VOCABULARY.find((e) => e.prop === prop)
      const props = entry?.pair
        ? VOCABULARY.filter((e) => e.pair?.group === entry.pair.group).map((e) => e.prop)
        : [prop]
      const one = new Map(props.map((p) => [p, tokens.get(p)]))
      const r = load(toDtcg(one, {}))
      assert(r.errors.length === 0, `${prop}: ${JSON.stringify(r.errors)}`)
      assert(r.warnings.length === 0, `${prop}: ${JSON.stringify(r.warnings)}`)
      eq(r.tokens.get(prop), raw, `${prop} did not come back the same`)
      n++
    }
  }
  return `${n} values`
})

/* --- The round trip on the real files ------------------------------------- */

for (const [file, theme] of [['src/tokens.css', undefined], ['themes/dark.css', 'dark']]) {
  check(`${file} exports and imports back to itself`, () => {
    const p = parseTokensCss(readFileSync(root + file, 'utf8'))
    const doc = toDtcg(p.tokens, { version: '0.0.0', build: 'test', theme, colorScheme: p.colorScheme })
    const f = fromDtcg(doc, { slots })
    assert(f.errors.length === 0, `errors: ${JSON.stringify(f.errors)}`)
    assert(f.warnings.length === 0, `warnings: ${JSON.stringify(f.warnings)}`)
    eq(f.colorScheme, p.colorScheme, 'the colour scheme did not survive')
    eq(f.theme, theme, 'the theme name did not survive')

    const p2 = parseTokensCss(toThemeCss(f.tokens, { theme: f.theme, colorScheme: f.colorScheme }))
    eq(p2.colorScheme, p.colorScheme, 'the emitted color-scheme differs')
    const a = [...p.tokens], b = [...p2.tokens]
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      eq(JSON.stringify(b[i]), JSON.stringify(a[i]), `declaration ${i} differs`)
    }
    return `${a.length} declarations, identical`
  })
}

check('the document identifies itself', () => {
  const { tokens, colorScheme } = parseTokensCss(readFileSync(root + 'themes/dark.css', 'utf8'))
  const ext = toDtcg(tokens, { version: '0.5.2', build: '0073498a', theme: 'dark', colorScheme }).$extensions['dev.largen']
  eq(ext.dtcg, DTCG_VERSION, 'the DTCG snapshot is not pinned')
  eq(ext.version, '0.5.2', 'no library version')
  eq(ext.build, '0073498a', 'no build id')
  eq(ext.theme, 'dark', 'no theme name')
  eq(ext.colorScheme, 'dark', 'no colour scheme')
  assert(!('description' in ext), 'an undefined key was emitted')
  return Object.keys(ext).join(', ')
})

check('the structural claims the JSON makes about the CSS', () => {
  const { tokens } = parseTokensCss(readFileSync(root + 'src/tokens.css', 'utf8'))
  const doc = toDtcg(tokens, {})
  eq(doc['default-tone'].$root.$value, '{tone.neutral.$root}', '--tone is not an alias of the neutral tone')
  eq(doc['default-tone'].contrast.$value, '{tone.neutral.on}', '--tone-contrast is not an alias')
  eq(doc.lift['1'].$value.color, '{shade}', '--lift-1 does not reference {shade}')
  eq(doc.lift['2'].$value.color, '{shade-strong}', '--lift-2 does not reference {shade-strong}')
  /* D7: same hex as --ink in both shipped themes is coincidence, and an alias
     would be a claim the CSS does not make. */
  assert(typeof doc.tone.neutral.$root.$value === 'object', 'tone.neutral.$root was exported as a reference')
  eq(doc.tone.$type, 'color', 'the tone group carries no $type')
  assert(!('$type' in doc.tone.primary.$root), 'a tone member restates the group $type')
  eq(doc.font.ui.$value[2], 'Segoe UI', 'a quoted family name kept its quotes')
  eq(doc.speed.$value.unit, 's', 'the duration unit was normalised')
  return 'aliases, shadow references, literal neutral, inherited $type'
})

check('the hand-written dark document imports to themes/dark.css exactly', () => {
  /* The other direction of the round trip: a document a person wrote, not one
     the exporter produced, has to land on the same declarations. */
  const css = parseTokensCss(readFileSync(root + 'themes/dark.css', 'utf8'))
  const r = load(fixture('dark'))
  assert(r.errors.length === 0 && r.warnings.length === 0, JSON.stringify(r.errors.concat(r.warnings)))
  eq(r.theme, 'dark', 'wrong theme name')
  eq(r.colorScheme, 'dark', 'wrong colour scheme')
  const a = [...css.tokens], b = [...r.tokens]
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    eq(JSON.stringify(b[i]), JSON.stringify(a[i]), `declaration ${i} differs`)
  }
  return `${b.length} declarations`
})

check('a whole consumer theme converts with one warning and nothing else', () => {
  const r = load(fixture('exe-like'))
  assert(r.errors.length === 0, `errors: ${JSON.stringify(r.errors)}`)
  eq(r.warnings.length, 1, `expected the retype warning alone, got ${JSON.stringify(r.warnings)}`)
  eq(r.warnings[0].path, 'line-height-base', 'the wrong token warned')
  eq(r.tokens.get('--text-display'), 'clamp(2.5rem, 8vw, 5rem)', 'the raw-CSS escape was lost')
  eq(r.tokens.get('--radius-sm'), '0', 'a zero radius came back with a unit')
  eq(r.tokens.get('--line-height-base'), '1.75rem', 'the retyped value was not emitted')
  const extras = [...r.tokens.keys()].filter((p) => !VOCABULARY.some((e) => e.prop === p))
  assert(extras.includes('--measure-page') && extras.includes('--control-sm'),
    `project extras were dropped: ${extras.join(' ')}`)
  return `${r.tokens.size} tokens, ${extras.length} of them extras`
})

/* --- Import validates before it emits ------------------------------------- */

check('a name containing { } or . is rejected', () =>
  only({ 'my.token': { $type: 'dimension', $value: { value: 1, unit: 'rem' } } },
    'errors', 'my.token', /may not contain/).errors[0].message)

check('a name starting with $ is rejected', () =>
  only({ $weird: { $type: 'number', $value: 1 } },
    'errors', '$weird', /may not start with \$/).errors[0].message)

check('a reference that does not resolve is rejected', () =>
  only({ canvas: { $type: 'color', $value: '{nope}' } },
    'errors', 'canvas', /\{nope\} does not resolve/).errors[0].message)

check('a reference cycle is rejected and named', () =>
  only(fixture('cycle'), 'errors', 'a', /cycle: a → b → a/).errors[0].message)

check('a token with no $value and no raw-CSS extension is rejected', () =>
  only({ canvas: { $type: 'color' } },
    'errors', 'canvas', /no \$value and no \$extensions/).errors[0].message)

check('a $value that fails its $type codec is rejected rather than passed through', () =>
  only(fixture('typo-colour'), 'errors', 'canvas', /not a colour: "#12345g"/).errors[0].message)

check('a space dimension that is not in rem is rejected', () =>
  only(fixture('space-px'), 'errors', 'space.4', /space stays in rem/).errors[0].message)

check('a tone with one half is rejected and the missing half is named', () =>
  only(fixture('half-tone'), 'errors', 'tone.primary.$root', /sets \$root without on/).errors[0].message)

check('an extra that flattens to a registered slot is rejected', () => {
  for (const slot of ['--pad', '--bg']) assert(slots.includes(slot), `${slot} is no longer a registered slot`)
  return only(fixture('slot-collision'), 'errors', ['pad', 'bg'], /registered slot/)
    .errors.map((e) => e.path).join(', ')
})

check('an extra that flattens to a derived tone name is rejected', () => {
  assert(DERIVED_NAMES.includes('--tone-soft'), '--tone-soft is no longer derived')
  return only({ 'tone-soft': { $type: 'color', $value: colour('#f4f5f7') } },
    'errors', 'tone-soft', /derives/).errors[0].message
})

check('an extra that flattens onto a vocabulary token is rejected as such', () =>
  /* --tone and --tone-contrast are both derived names and vocabulary tokens;
     the vocabulary message is the one that tells a consumer where to put it. */
  only({ 'tone-contrast': { $type: 'color', $value: colour('#ffffff') } },
    'errors', 'tone-contrast', /vocabulary token default-tone\.contrast/).errors[0].message)

check('hex and components that disagree are rejected', () =>
  only(fixture('both-disagree'), 'errors', 'canvas', /disagree/).errors[0].message)

check('a retyped vocabulary token warns, names both types, and still emits', () => {
  const r = only({ 'line-height-base': { $type: 'dimension', $value: { value: 1.75, unit: 'rem' } } },
    'warnings', 'line-height-base', /number.*dimension/)
  eq(r.tokens.get('--line-height-base'), '1.75rem', 'the retyped value was not emitted')
  return r.warnings[0].message
})

/* --- Colour forms and the escape hatch ------------------------------------ */

check('a colour given as hex alone is accepted', () => {
  const r = load(fixture('hex-only'))
  assert(r.errors.length === 0 && r.warnings.length === 0, JSON.stringify(r.errors.concat(r.warnings)))
  eq(r.tokens.get('--canvas'), '#101214', 'hex-only did not survive')
  return '#101214'
})

check('a colour given as components alone is accepted', () => {
  const r = load(fixture('components-only'))
  assert(r.errors.length === 0 && r.warnings.length === 0, JSON.stringify(r.errors.concat(r.warnings)))
  /* Components round to the hex a person would have written, which is why the
     export carries both and emission prefers the hex. */
  eq(r.tokens.get('--canvas'), '#101214', 'components-only did not survive')
  return '#101214'
})

check('alpha comes back as rgba(), and a zero length as a bare 0', () => {
  const r = load({
    shade: { $type: 'color', $value: { colorSpace: 'srgb', components: [1, 1, 1], alpha: 0.07 } },
    radius: { $type: 'dimension', sm: { $value: { value: 0, unit: 'rem' } } },
  })
  assert(r.errors.length === 0, JSON.stringify(r.errors))
  eq(r.tokens.get('--shade'), 'rgba(255, 255, 255, 0.07)', 'alpha was lost')
  eq(r.tokens.get('--radius-sm'), '0', 'DTCG needs a unit on zero; CSS authors do not')
  return 'rgba(255, 255, 255, 0.07) and 0'
})

check('a raw-CSS extension is emitted verbatim, fallback $value or not', () => {
  const r = load({
    text: {
      display: {
        $type: 'dimension',
        $value: { value: 5, unit: 'rem' },
        $extensions: { 'dev.largen': { css: 'clamp(2.5rem, 8vw, 5rem)' } },
      },
    },
  })
  assert(r.errors.length === 0 && r.warnings.length === 0, JSON.stringify(r.errors.concat(r.warnings)))
  eq(r.tokens.get('--text-display'), 'clamp(2.5rem, 8vw, 5rem)', 'the escape hatch did not survive')
  return '--text-display: clamp(2.5rem, 8vw, 5rem)'
})

check('a project extra flattens by joining its path with -', () => {
  const r = load({ syntax: { comment: { $type: 'color', $value: { hex: '#5c636e' } } } })
  assert(r.errors.length === 0, JSON.stringify(r.errors))
  eq([...r.tokens.keys()].join(','), '--syntax-comment', 'an extra flattened wrongly')
  return '--syntax-comment'
})

check('a reference to a vocabulary token keeps the dependency as var()', () => {
  /* This is what makes a theme that moves --shade move the shadows with it. */
  const r = load({
    lift: { $type: 'shadow', 1: { $value: { color: '{shade}', offsetX: { value: 0, unit: 'px' }, offsetY: { value: 1, unit: 'px' }, blur: { value: 2, unit: 'px' }, spread: { value: 0, unit: 'px' } } } },
    'default-tone': { $root: { $type: 'color', $value: '{tone.neutral.$root}' } },
  })
  assert(r.errors.length === 0, JSON.stringify(r.errors))
  eq(r.tokens.get('--lift-1'), '0 1px 2px var(--shade)', 'the shadow inlined the shade')
  eq(r.tokens.get('--tone'), 'var(--neutral)', 'the alias was inlined')
  return '0 1px 2px var(--shade)'
})

check('a reference to a project extra resolves to its value', () => {
  /* The other direction: nothing downstream knows an extra's name, so it is
     flattened rather than pointed at. */
  const r = load({
    brand: { $type: 'color', $value: { hex: '#1c6fd6' } },
    accent: { $type: 'color', $value: '{brand}' },
  })
  assert(r.errors.length === 0, JSON.stringify(r.errors))
  eq(r.tokens.get('--accent'), '#1c6fd6', 'an extra reference was not resolved')
  return '--accent: #1c6fd6'
})

/* --- Emission ------------------------------------------------------------- */

const darkTokens = new Map([['--canvas', '#101214'], ['--ink', '#f2f4f6']])

check('the default output is layered, under the theme selector, color-scheme last', () => {
  const css = toThemeCss(darkTokens, { theme: 'dark', colorScheme: 'dark' })
  assert(css.includes('@layer largen.tokens {'), 'not layered')
  assert(css.includes('  [data-theme="dark"] {'), 'wrong selector or indentation')
  const decls = css.split('\n').filter((l) => l.trim().endsWith(';')).map((l) => l.trim())
  /* Last, like src/tokens.css and themes/dark.css, so a generated block diffs
     cleanly against a hand-written one. */
  eq(decls[decls.length - 1], 'color-scheme: dark;', 'color-scheme is not last')
  eq(decls.length, 3, 'wrong number of declarations')
  assert(css.split('\n').every((l) => !/^\t/.test(l)), 'tabs in the output')
  return decls.join(' ')
})

check('no theme name means :root', () => {
  const css = toThemeCss(darkTokens, { colorScheme: 'light' })
  assert(/\n {2}:root \{/.test(css), `expected a :root rule:\n${css}`)
  return ':root'
})

check('--unlayered emits no @layer wrapper', () => {
  const css = toThemeCss(darkTokens, { theme: 'dark', colorScheme: 'dark', layered: false })
  assert(!css.includes('@layer'), 'the unlayered output is still layered')
  assert(css.startsWith('[data-theme="dark"] {'), `the rule is not at the top level:\n${css}`)
  /* An unlayered theme outranks every layer, so the header has to say so; the
     header itself is the caller's string, and it is placed verbatim. */
  const withHeader = toThemeCss(darkTokens, { layered: false, header: '/* unlayered */' })
  assert(withHeader.startsWith('/* unlayered */\n'), 'the header is not first')
  return 'no @layer, header first'
})

check('--scheme-media emits both selectors with identical declaration lists', () => {
  const css = toThemeCss(darkTokens, { theme: 'dark', colorScheme: 'dark', schemeMedia: true })
  assert(css.includes('@media (prefers-color-scheme: dark) {'), 'no preference block')
  assert(css.includes(':root:not([data-theme="light"]) {'), 'the preference block has the wrong selector')
  const lists = [...css.matchAll(/\{\n([^{}]*)\n\s*\}/g)].map((m) =>
    m[1].split('\n').map((l) => l.trim()).filter(Boolean).join(' '))
  assert(lists.length === 2, `expected two declaration blocks, got ${lists.length}`)
  eq(lists[1], lists[0], 'the two blocks differ')
  /* And the media block lives inside the layer, not beside it. */
  assert(css.indexOf('@media') > css.indexOf('@layer'), 'the media block escaped the layer')
  return `${lists[0].split(';').length - 1} declarations, twice`
})

check('a light document takes the mirrored :not() selector', () => {
  const css = toThemeCss(darkTokens, { theme: 'light', colorScheme: 'light', schemeMedia: true })
  assert(css.includes('@media (prefers-color-scheme: light) {'), 'wrong preference')
  assert(css.includes(':root:not([data-theme="dark"]) {'), 'wrong :not() selector')
  return ':root:not([data-theme="dark"])'
})

check('the emitted stylesheet parses back', () => {
  const css = toThemeCss(darkTokens, { theme: 'dark', colorScheme: 'dark', schemeMedia: true, header: '/* GENERATED */' })
  const p = parseTokensCss(css)
  eq(p.selector, '[data-theme="dark"]', 'the parser read the wrong rule')
  eq(p.colorScheme, 'dark', 'the parser lost color-scheme')
  eq(JSON.stringify([...p.tokens]), JSON.stringify([...darkTokens]), 'the parser lost declarations')
  return `${p.tokens.size} declarations`
})

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
