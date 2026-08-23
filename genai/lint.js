/* largen — lint authored component CSS against the authoring contract.
 *
 * Zero dependencies, and deliberately snippet-oriented rather than
 * repository-oriented: the same rules have to apply to a file on disk during
 * `largen verify` and to a string a model just produced and handed to the MCP
 * server. Writing them twice would guarantee the two answers eventually differ,
 * so they are written here once and both callers import them.
 *
 * These are static checks. They cannot see whether anything renders — a previous
 * build passed every static check while six components were visibly broken.
 */

const RAW_SEMANTIC = /var\(\s*--(primary|secondary|success|info|warning|danger|neutral)(-on)?\s*\)/
const COLOUR_LITERAL = /(#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\()/i

export const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** The registered slots, read from the library's own @property declarations so
 *  this list can never drift from the ones the paint rule actually consults. */
export function registeredSlots(propertiesCss) {
  const names = []
  for (const m of strip(propertiesCss).matchAll(/@property\s+(--[\w-]+)\s*\{([^}]*)\}/g)) {
    if (/inherits:\s*false/.test(m[2])) names.push(m[1])
  }
  return names
}

/* Custom properties a component may legitimately set that are not paint slots:
   the tone family it derives from, the scale multiplier, and the layout
   utilities' own knobs. Setting one of these is not a mistake. */
const NON_SLOT_ALLOWED = new Set([
  '--tone', '--tone-soft', '--tone-ink', '--tone-line', '--tone-contrast',
  '--scale', '--min-item', '--measure', '--flow', '--side', '--speed',
])

/**
 * Lint a component CSS snippet.
 *
 * @param {string} css      the snippet
 * @param {object} options
 * @param {string[]} options.slots  registered slot names
 * @returns {{ok: boolean, findings: object[]}}
 */
/* The region of a snippet that actually declares components.
 *
 * The content rules below — no colour literals, no reaching past --tone*, only
 * registered slots — are rules about *components*. A theme legitimately contains
 * `oklch()` and legitimately sets `--canvas`, and judging it by component rules
 * produces confident nonsense. So the content rules see only what is inside
 * `@layer largen.components`; when there is no such block the snippet is treated
 * as a bare component, which is what a caller passing one to check_component_css
 * means. */
const LAYER_BLOCK = /@layer\s+largen\.components\s*\{/

function componentRegion(clean) {
  const m = clean.match(LAYER_BLOCK)
  if (!m) return clean
  const open = m.index + m[0].length - 1
  let depth = 0
  for (let i = open; i < clean.length; i++) {
    if (clean[i] === '{') depth++
    else if (clean[i] === '}') { depth--; if (depth === 0) return clean.slice(0, i + 1) }
  }
  return clean
}

/**
 * Classify a stylesheet without linting it.
 *
 * The content rules are rules about components, so pointing them at a theme
 * produces confident nonsense — a theme legitimately contains `oklch()` and
 * legitimately sets `--canvas`. `largen verify` has always known this and
 * skipped non-component files during discovery. The batched MCP form did not,
 * and the difference was not theoretical: a caller passed a components directory
 * plus one token sheet and got 130 findings, every token flagged as a colour
 * literal in an undeclared component. Two surfaces of the same linter cannot be
 * allowed to disagree, so both now ask this function.
 *
 * The single-string form deliberately does NOT consult this. Passing one snippet
 * means "check this component I just wrote", and answering "that is not a
 * component" instead of "you forgot the layer" would lose the most valuable
 * finding the linter has.
 *
 * WHAT COUNTS AS A COMPONENT
 *
 * Not "declares inside @layer largen.components" alone. A component that forgot
 * the layer is still a component, and the missing layer is the single most
 * valuable thing this linter reports — `data-variant` stops applying while tone
 * and size keep working, so it looks like a partial success rather than a
 * mistake. Classifying that file away as "not a component" would throw the
 * finding out on the strength of the very error being looked for.
 *
 * So a file is a component if it declares in the layer, OR sets a registered
 * paint slot while using no largen layer at all. The slots are what largen paints
 * from, so setting one is authoring a component wherever you wrote it — but a
 * file that sets slots inside `largen.tone` or `largen.modifiers` is the library's
 * own algebra, not a component that forgot its layer, and judging it by the
 * component rules is the same confident nonsense in a different costume. A theme
 * sets tokens — `--canvas`, `--ink` — which are not slots, so it classifies out
 * either way.
 *
 * @param {string} css
 * @param {string[]} [slots] registered slot names; without them only the layer counts
 * @returns {{kind: 'component'|'not-component'|'minified', why: string|null}}
 */
export function classifySheet(css, slots = []) {
  const text = String(css)

  /* Minified output is not source. Every finding in it would carry line 1, and
     the file it was built from is already being checked.
     
     Detected by line LENGTH, not by absence of newlines. The earlier test — no
     newline in the first 2kb — was defeated the moment builds gained a banner
     comment, which ends in a newline at byte 54. Every frozen release then read
     as source, and the linter judged a whole minified bundle as one 9kb line of
     component CSS. A run of a few hundred characters with no line break is the
     actual signal; largen's own source never exceeds 200. */
  const longestLine = text.split('\n').reduce((m, l) => (l.length > m ? l.length : m), 0)
  if (longestLine > 500) {
    return { kind: 'minified', why: 'built output, not source — check the file it was built from' }
  }

  /* The block, not the name. `src/largen.css` lists largen.components in its
     @layer *statement* without opening one, and a substring test calls that a
     component file and then faults it for being unlayered. */
  if (LAYER_BLOCK.test(text)) return { kind: 'component', why: null }

  const clean = strip(text)
  const inLargenLayer = /@layer\s+largen\.[\w-]+\s*\{/.test(clean)
  const sets = inLargenLayer
    ? []
    : slots.filter((slot) => new RegExp(`(^|[;{\\s])${slot}\\s*:`).test(clean))
  if (sets.length) return { kind: 'component', why: null, unlayered: sets }

  return {
    kind: 'not-component',
    why: inLargenLayer
      ? 'declares inside another largen layer, not `largen.components` — library or system CSS'
      : 'declares nothing inside `@layer largen.components` and sets no paint slot — ' +
        'a theme, token or reset sheet',
  }
}

export function lintComponentCss(css, { slots = [] } = {}) {
  const findings = []
  const SLOTS = new Set(slots)
  const clean = strip(css)
  const region = componentRegion(clean)
  const lines = region.split('\n')

  const at = (i) => i + 1
  const add = (rule, severity, line, message, why) =>
    findings.push({ rule, severity, line, message, why })

  /* --- 1. The layer rule. This is the one that matters most. ------------- */
  if (!/@layer\s+largen\.components\s*\{/.test(clean)) {
    add('layer', 'error', null,
      'the component is not declared inside `@layer largen.components`',
      'An unlayered component outranks `largen.modifiers`, so `data-variant` will ' +
      'silently stop applying — while `data-tone` and `data-size` keep working, ' +
      'because those act through inheriting custom properties rather than by ' +
      'overriding slots. One dead axis and two live ones is the worst failure mode ' +
      'in largen: it looks like it works. Wrap the rule in ' +
      '`@layer largen.components { … }`.')
  }

  /* --- 2. Colour literals ------------------------------------------------ */
  lines.forEach((line, i) => {
    if (COLOUR_LITERAL.test(line)) {
      add('colour-literal', 'error', at(i),
        `hard-coded colour: ${line.trim()}`,
        'A literal cannot follow a theme swap. Route it through a token ' +
        '(`var(--surface)`, `var(--ink)`) or a tone derivation (`var(--tone-soft)`).')
    }
  })

  /* --- 3. Reaching past the tone axis ------------------------------------
   *
   * The offence is *consuming* a raw semantic token — `--bg: var(--danger)` pins
   * a component to one colour and stops it responding to `data-tone`.
   *
   * Assigning one to `--tone` is the opposite: it is how a component chooses the
   * tone its subtree resolves against, and it is exactly what src/algebra.css
   * does for every `[data-tone="…"]`. So the property matters, not just the
   * value, and a check that only reads the value rejects correct code — which is
   * how this rule was first written. */
  lines.forEach((line, i) => {
    for (const decl of line.split(';')) {
      const prop = decl.match(/(--[\w-]+)\s*:/)
      if (!prop || prop[1].startsWith('--tone')) continue
      if (!RAW_SEMANTIC.test(decl)) continue
      add('raw-semantic-token', 'error', at(i),
        `reaches past the tone axis: ${decl.trim()}`,
        'Raw semantic tokens are absolute; `--tone*` is relative to whatever tone is ' +
        'in scope. Naming the absolute one opts the component out of `data-tone` ' +
        'entirely, which stays invisible until someone sets a tone on an ancestor. ' +
        'Use `var(--tone)`, `var(--tone-soft)`, `var(--tone-ink)` or `var(--tone-line)`. ' +
        'Setting `--tone` itself to a semantic token is fine — that is how a ' +
        'component picks the tone its subtree resolves against.')
    }
  })

  /* --- 4. Unregistered custom properties --------------------------------- */
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/(?:^|[;{\s])(--[\w-]+)\s*:/g)) {
      const name = m[1]
      if (SLOTS.has(name) || NON_SLOT_ALLOWED.has(name)) continue
      /* A component-private variable is fine as long as it feeds a real slot;
         what is worth reporting is one that nothing consumes. */
      if (new RegExp(`var\\(\\s*${name}\\b`).test(clean)) continue
      add('unregistered-slot', 'warning', at(i),
        `\`${name}\` is not a registered slot and nothing reads it`,
        'The universal paint rule only consults registered slots, so this ' +
        'declaration has no effect on paint. Either set a registered slot ' +
        `(${slots.slice(0, 4).join(', ')}, …) or read \`${name}\` from one.`)
    }
  })

  /* --- 5. --tone-contrast does not follow --tone ---------------------------
   *
   * The soft/ink/line derivations recompute on every element, so setting --tone
   * anywhere works for them. --tone-contrast is different: it is a paired token
   * (--danger-on for --danger), not a formula, so nothing can derive it. A rule
   * that sets --tone and reads var(--tone-contrast) gets whichever contrast was
   * in scope — a fill in the right colour with unreadable text on it. */
  for (const m of region.matchAll(/\{([^{}]*)\}/g)) {
    const block = m[1]
    const setsTone = /(?:^|[;{\s])--tone\s*:/.test(block)
    const readsContrast = /var\(\s*--tone-contrast\b/.test(block)
    const setsContrast = /(?:^|[;{\s])--tone-contrast\s*:/.test(block)
    if (setsTone && readsContrast && !setsContrast) {
      const line = region.slice(0, m.index).split('\n').length
      add('tone-contrast-unpaired', 'error', line,
        'sets `--tone` and reads `var(--tone-contrast)` without setting it',
        '`--tone-contrast` is a paired token, not a derivation — `--danger` pairs ' +
        'with `--danger-on`, and no formula produces one from the other. Unlike ' +
        '`--tone-soft`, `--tone-ink` and `--tone-line`, which recompute on every ' +
        'element, this one keeps whatever value was already in scope. The result ' +
        'is a fill in the new colour with the old colour\'s text on it. Set both ' +
        'together: `--tone: var(--danger); --tone-contrast: var(--danger-on)`.')
    }
  }

  /* --- 6. !important ------------------------------------------------------ */
  lines.forEach((line, i) => {
    if (line.includes('!important')) {
      add('important', 'error', at(i),
        '`!important` is never needed in largen',
        'Every largen selector is `:where()`-wrapped and every rule is layered, so ' +
        'consumer CSS already wins. `!important` here will instead defeat the ' +
        'overrides someone else is relying on.')
    }
  })

  return { ok: findings.filter((f) => f.severity === 'error').length === 0, findings }
}

export default lintComponentCss
