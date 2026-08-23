/* Check components against the authoring contract.
 *
 * Two different jobs used to live here under one name, both reading files
 * resolved from the package root. That was wrong in a way worth spelling out:
 * run from another project, `largen verify` reported on largen's own stylesheets
 * and said nothing about the caller's — the command SKILL.md advertises as
 * "check components against the contract" checked the wrong components, and said
 * "ok" while doing it.
 *
 * So:
 *
 *   contract checks   run against the CALLER's files, always. The rules come from
 *                     genai/lint.js, which the MCP server's check_component_css
 *                     also uses, so a component cannot pass locally and fail
 *                     hosted.
 *
 *   library invariants run only when the package root IS the working directory,
 *                     which is true exactly when someone is developing largen.
 *                     They are assertions about src/, and meaningless elsewhere.
 *
 * These are static checks either way. They cannot see whether anything renders,
 * and a previous build passed every one of them while six components were
 * visibly broken. Screenshots are the other half, not an optional extra.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { at, root } from './paths.mjs'
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

/** Developing largen itself, rather than consuming it. */
const inLibraryRepo = () => resolve(process.cwd()) === resolve(root) && existsSync(at('src/properties.css'))

const SKIP = new Set(['node_modules', '.git', 'dist', '.previews'])

/** CSS under a directory, for when no paths were given. Bounded depth, because
 *  scanning a whole project tree to lint four files is a poor trade. */
function discover(dir, depth = 0) {
  if (depth > 4) return []
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name) || entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...discover(full, depth + 1))
    else if (entry.name.endsWith('.css')) out.push(full)
  }
  return out
}

/* --- The library's own invariants ---------------------------------------- */

function libraryInvariants() {
  check('no slot declares an initial-value', () => {
    const props = strip(read('src/properties.css'))
    const offenders = []
    for (const m of props.matchAll(/@property\s+(--[\w-]+)\s*\{([^}]*)\}/g)) {
      const [, name, body] = m
      /* --scale is the documented exception: it is a multiplier rather than a
         paint slot, so it must always resolve to a number. */
      if (name === '--scale') continue
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
    const files = readdirSync(at('src')).filter((f) => f.endsWith('.css')).map((f) => `src/${f}`)
    const bad = files.filter((f) => strip(read(f)).includes('!important'))
    assert(bad.length === 0, `found in ${bad.join(', ')}`)
    return 'consumer CSS always wins'
  })

  /* The bug this exists to prevent was reported from the outside, not caught
     here: themes/*.css shipped unlayered while src/tokens.css was layered, so a
     consumer's token overrides written inside `@layer largen.tokens` lost to
     largen's own theme. It was invisible in light mode and total in dark. */
  check('every stylesheet largen ships is layered', () => {
    const files = [
      ...readdirSync(at('src')).filter((f) => f.endsWith('.css')).map((f) => `src/${f}`),
      ...readdirSync(at('themes')).filter((f) => f.endsWith('.css')).map((f) => `themes/${f}`),
      ...readdirSync(at('components')).filter((f) => f.endsWith('.css')).map((f) => `components/${f}`),
    ]
    const unlayered = []
    for (const f of files) {
      const css = strip(read(f))
      /* properties.css registers @property, which cannot live in a layer, and
         largen.css is the entry point: imports and the order statement only. */
      if (f === 'src/properties.css' || f === 'src/largen.css') continue
      if (!/@layer\s+largen\.[a-z]+\s*\{/.test(css) && /[^\s]/.test(css.replace(/@import[^;]*;/g, ''))) {
        unlayered.push(f)
      }
    }
    assert(unlayered.length === 0,
      `${unlayered.join(', ')} ship unlayered. Unlayered author CSS outranks every ` +
      `layer, so these would beat a consumer's own overrides written inside a largen ` +
      `layer — silently, and only in whichever mode the file governs.`)
    return `${files.length - 2} files, all inside a largen layer`
  })

  check('paint.css is inside a cascade layer', () => {
    assert(/@layer largen\.paint\s*\{/.test(strip(read('src/paint.css'))),
      'revert-layer only works from inside a layer; unlayered, this rule strips ' +
      'UA defaults from every element on the page')
    return 'revert-layer is meaningful'
  })

  check('the conformance page still exists and links the real stylesheet', () => {
    assert(existsSync(at('demo/conformance.html')), 'demo/conformance.html is missing')
    const html = read('demo/conformance.html')
    assert(/src\/largen\.css/.test(html),
      'conformance.html must test src/largen.css, not a copy or a bundle')
    assert(/__largen/.test(html), 'conformance.html must expose its results on window.__largen')
    return 'open it in Safari, Firefox and Chrome — this check cannot run it'
  })
}

/* --- The contract, against whatever the caller pointed at ---------------- */

export async function verify(args = []) {
  const paths = args.filter((a) => !a.startsWith('--'))
  const self = inLibraryRepo()

  console.log('\n  largen verify\n')

  const files = paths.length
    ? paths.map((p) => resolve(p))
    : discover(process.cwd())

  const missing = files.filter((f) => !existsSync(f) || !statSync(f).isFile())
  if (missing.length) {
    console.log(`  FAIL  no such file: ${missing.map((f) => relative(process.cwd(), f)).join(', ')}\n`)
    return 1
  }

  if (!files.length) {
    console.log('  No CSS found. Pass paths explicitly:\n')
    console.log('      largen verify src/components.css\n')
    return 1
  }

  const slots = registeredSlots(read('src/properties.css'))
  let errors = 0, warnings = 0, clean = 0

  /* Discovery finds every stylesheet; only some declare components. A theme, a
     token file or a reset is not a component and judging it by component rules
     would report confident nonsense. Explicit paths are always checked — if you
     named a file, you meant it. */
  /* The block, not the name. `src/largen.css` lists largen.components in its
     @layer *statement* without opening one, and a substring test calls that a
     component file and then faults it for being unlayered. */
  const declares = (f) => /@layer\s+largen\.components\s*\{/.test(readFileSync(f, 'utf8'))

  /* Minified output is not source. Every finding in it would carry line 1, and
     the file it was built from is already being checked. */
  const minified = (f) => {
    const text = readFileSync(f, 'utf8')
    return text.length > 500 && !text.slice(0, 2000).includes('\n')
  }

  const wanted = (f) => declares(f) && !minified(f)
  const skipped = paths.length ? [] : files.filter((f) => !wanted(f))
  const checking = paths.length ? files.filter((f) => !minified(f)) : files.filter(wanted)

  if (!checking.length) {
    console.log(`  No component stylesheets found among ${files.length} CSS file(s).`)
    console.log('  A component is declared inside `@layer largen.components`.\n')
    return failures ? 1 : 0
  }

  for (const file of checking) {
    const rel = relative(process.cwd(), file) || file
    const { findings } = lintComponentCss(readFileSync(file, 'utf8'), { slots })
    /* A stylesheet with no components is not a failure — a theme file has none.
       Only report a file that declares something and gets it wrong. */
    if (!findings.length) { clean++; continue }
    for (const f of findings) {
      const where = `${rel}${f.line ? `:${f.line}` : ''}`
      if (f.severity === 'error') { errors++; console.log(`  FAIL  ${where}\n        ${f.message}\n        ${f.why}`) }
      else { warnings++; console.log(`  note  ${where} — ${f.message}`) }
    }
  }

  if (!errors) {
    console.log(`  ok    the authoring contract — ${checking.length} component file(s), ${clean} clean` +
      (skipped.length ? ` (${skipped.length} non-component file(s) skipped)` : ''))
  }

  if (self) {
    console.log()
    libraryInvariants()
  }

  console.log()
  const total = errors + failures
  if (total) { console.log(`  ${total} problem(s)\n`); return 1 }
  console.log(`  all static checks passed${warnings ? ` (${warnings} note(s))` : ''}`)
  console.log('  (static only — render the result in a browser, in both themes)\n')
  return 0
}
