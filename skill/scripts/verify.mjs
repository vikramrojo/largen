/* Check largen and its components against the authoring contract.
 *
 * Optional. These are static checks; they cannot see whether anything actually
 * renders. That gap is real and has bitten before — a previous build passed
 * every static check while six components were visibly broken. Screenshots are
 * the other half of verification, not an optional extra.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { at } from './paths.mjs'
import { lintComponentCss, registeredSlots } from '../../genai/lint.js'

const read = (p) => readFileSync(at(p), 'utf8')
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')

let failures = 0
const check = (name, fn) => {
  try {
    const detail = fn()
    console.log(`  ok    ${name}${detail ? ` — ${detail}` : ''}`)
  } catch (e) {
    failures++
    console.log(`  FAIL  ${name}\n        ${e.message}`)
  }
}
const assert = (c, m) => { if (!c) throw new Error(m) }

/* Every file that declares components: the library's optional ones, plus any
   site component sets. */
const componentFiles = [
  ...readdirSync(at('components')).filter((f) => f.endsWith('.css') && f !== 'index.css')
    .map((f) => `components/${f}`),
  ...(existsSync(at('sites')) ? readdirSync(at('sites')).flatMap((s) =>
    readdirSync(at('sites', s)).filter((f) => f === 'components.css').map((f) => `sites/${s}/${f}`)) : []),
]

export async function verify() {
  console.log('\n  largen verify\n')

  /* --- The invariant the whole design rests on -------------------------- */
  check('no slot declares an initial-value', () => {
    const props = strip(read('src/properties.css'))
    const offenders = []
    for (const m of props.matchAll(/@property\s+(--[\w-]+)\s*\{([^}]*)\}/g)) {
      const [, name, body] = m
      if (name === '--scale') continue // inheriting, and legitimately has one
      if (/initial-value/.test(body)) offenders.push(name)
    }
    assert(offenders.length === 0,
      `${offenders.join(', ')} declare initial-value. A slot with an initial value is ` +
      `never unset, so var(--x, revert-layer) never fires and the universal paint ` +
      `rule resets every element's UA defaults.`)
    return 'unset slots stay guaranteed-invalid'
  })

  check('every slot is registered inherits:false', () => {
    const props = strip(read('src/properties.css'))
    const reg = new Map()
    for (const m of props.matchAll(/@property\s+(--[\w-]+)\s*\{([^}]*)\}/g)) {
      reg.set(m[1], /inherits:\s*false/.test(m[2]))
    }
    const paint = strip(read('src/paint.css'))
    const used = [...paint.matchAll(/var\((--[\w-]+),\s*revert-layer\)/g)].map((m) => m[1])
    assert(used.length > 0, 'paint.css declares no slots')
    const bad = used.filter((s) => reg.get(s) !== true)
    assert(bad.length === 0, `used by paint but not registered inherits:false: ${bad.join(', ')}`)
    return `${used.length} slots`
  })

  check('every painted property falls back to revert-layer', () => {
    const paint = strip(read('src/paint.css'))
    const decls = [...paint.matchAll(/^\s{4}([a-z-]+):\s*(.+);$/gm)]
    assert(decls.length > 0, 'could not parse paint.css')
    const bad = decls.filter(([, , value]) => !value.includes('revert-layer'))
    assert(bad.length === 0,
      `these would reset UA defaults on every element: ${bad.map((d) => d[1]).join(', ')}`)
    return `${decls.length} properties`
  })

  /* --- The authoring contract -------------------------------------------
   *
   * These rules are defined in genai/lint.js rather than here, because the MCP
   * server's check_component_css has to apply exactly the same ones to a snippet
   * a model just wrote. Two implementations would eventually give two answers.
   */
  const slots = registeredSlots(read('src/properties.css'))

  check('components satisfy the authoring contract', () => {
    const errors = [], warnings = []
    for (const f of componentFiles) {
      const { findings } = lintComponentCss(read(f), { slots })
      for (const x of findings) {
        const where = `${f}${x.line ? `:${x.line}` : ''}`
        ;(x.severity === 'error' ? errors : warnings).push(`${where} — ${x.message}`)
      }
    }
    if (warnings.length) {
      console.log(warnings.map((w) => `        note: ${w}`).join('\n'))
    }
    assert(errors.length === 0, errors.join('\n        '))
    return `${componentFiles.length} component files clean` +
      (warnings.length ? ` (${warnings.length} note(s))` : '')
  })

  /* --- Cascade discipline ----------------------------------------------- */
  check('layer order puts modifiers last', () => {
    const decl = strip(read('src/largen.css')).match(/@layer\s+([^;]+);/)
    assert(decl, 'no @layer statement in largen.css')
    const layers = decl[1].split(',').map((s) => s.trim())
    const expected = ['largen.reset', 'largen.tokens', 'largen.paint', 'largen.tone',
      'largen.elements', 'largen.components', 'largen.modifiers']
    assert(JSON.stringify(layers) === JSON.stringify(expected),
      `order is ${layers.join(' < ')}, expected ${expected.join(' < ')}`)
    return layers.join(' < ')
  })

  check('no !important anywhere', () => {
    const all = [...componentFiles, ...readdirSync(at('src')).map((f) => `src/${f}`)]
      .filter((f) => f.endsWith('.css'))
    // Strip comments first — largen.css's own docs mention !important to say
    // you never need it, and matching that would be an own goal.
    const bad = all.filter((f) => strip(read(f)).includes('!important'))
    assert(bad.length === 0, `found in ${bad.join(', ')}`)
    return 'consumer CSS always wins'
  })

  check('paint.css is inside a cascade layer', () => {
    assert(/@layer largen\.paint\s*\{/.test(strip(read('src/paint.css'))),
      'revert-layer only works from inside a layer; unlayered, this rule strips ' +
      'UA defaults from every element on the page')
    return 'revert-layer is meaningful'
  })

  /* The static checks above can prove paint.css is layered; they cannot prove
     an engine honours revert-layer. Only demo/conformance.html can, and only
     when actually opened. Keep it from rotting. */
  check('the conformance page still exists and links the real stylesheet', () => {
    assert(existsSync(at('demo/conformance.html')), 'demo/conformance.html is missing')
    const html = read('demo/conformance.html')
    assert(html.includes('../src/largen.css'),
      'conformance.html must test src/largen.css, not a copy or a bundle')
    assert(html.includes('window.__largen'),
      'conformance.html must expose its results on window.__largen')
    return 'open it in Safari, Firefox and Chrome — this check cannot run it'
  })

  console.log()
  if (failures) { console.log(`  ${failures} check(s) failed\n`); return 1 }
  console.log('  all static checks passed')
  console.log('  (static only — run the demo pages through a browser too)\n')
  return 0
}
