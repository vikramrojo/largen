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
export function lintComponentCss(css, { slots = [] } = {}) {
  const findings = []
  const SLOTS = new Set(slots)
  const clean = strip(css)
  const lines = clean.split('\n')

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

  /* --- 5. !important ------------------------------------------------------ */
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
