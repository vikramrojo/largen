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
 * The severity of the coined-tag rule, in one place because it is staged.
 *
 * It ships as a warning: the rule is new, and a project that passed `verify`
 * clean yesterday has to pass today. It becomes an error in the next minor,
 * announced in MIGRATING.md — and the promotion is this constant and nothing
 * else, which is the reason the value is not written at the call site.
 */
export const COINED_TAG_SEVERITY = 'error'

/* Leading tokens that name a role, and the element that already has it.
 *
 * Deliberately short. The tempting version of this rule is an ARIA-role
 * inference table, which is exactly the version that fires on `entry-link`,
 * `facet-label` and `field-row` — three real selectors in this repository, none
 * of them a mistake. Matching only the LEADING token keeps those silent, and a
 * nine-entry list covers the mistakes that actually get made. False positives
 * are the known risk here and the short list is half the mitigation; shipping
 * at warning severity first is the other half. */
const ROLE_TAGS = {
  button: 'button', nav: 'nav', dialog: 'dialog', input: 'input', select: 'select',
  form: 'form', menu: 'menu', a: 'a', label: 'label',
}

/**
 * The native element a coined tag name is impersonating, or null.
 *
 * Exported because the same question is asked of a manifest component's
 * `element` field, and a second copy of the list is how two surfaces come to
 * disagree. A name with no hyphen is not a coined tag at all — `button` IS the
 * native button — so it returns null.
 *
 * @param {string} name  an element name, e.g. `button-primary`
 * @returns {string|null} the native element name, e.g. `button`
 */
export function nativeElementFor(name) {
  const m = /^([a-z][a-z0-9]*)-[a-z0-9-]+$/.exec(String(name ?? '').trim().toLowerCase())
  return m ? (ROLE_TAGS[m[1]] ?? null) : null
}

/* The size axis, and the slots a size variant re-sets. Both are the shapes the
   check looks for; neither is a list of values it invents. */
const SIZE_VALUES = ['xs', 'sm', 'md', 'lg', 'xl']
const SCALE_SLOTS = ['--pad', '--font-size', '--gap']

/** Innermost rules: the selector text and the declaration block it opens.
 *
 *  At-rule preambles are skipped — `@media (…) {` never reaches here as a
 *  selector because the pattern only completes on a block with no nested
 *  braces, but `@font-face { … }` does, and it is not a selector either. */
function eachRule(css, fn) {
  for (const m of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const selector = m[1].trim()
    if (!selector || selector.startsWith('@')) continue
    fn(selector, m[2], m.index)
  }
}

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
  /* ANY layer block, not only a largen one.
   *
   * This used to ask whether the file declared inside a largen layer, and a file
   * that set paint slots inside its own — `@layer site-base { * { --weight: 300 } }`,
   * a framework default, exactly what a migration writes — came back as a component
   * that had forgotten its layer. It had not; it was layered, deliberately, in a
   * layer of its own.
   *
   * The heuristic existed because nothing could evaluate the real question, which
   * is not "which layer is this in" but "does this declaration win". checkComponentsApply
   * answers that now, across files, and answers it about the cascade rather than
   * about a name. A file that sets slots and opens no layer at all is still the
   * genuine forgot-the-layer case and is still caught here. */
  const inLargenLayer = /@layer\s+[\w-]+(?:\.[\w-]+)*\s*\{/.test(clean)
  const sets = inLargenLayer
    ? []
    : slots.filter((slot) => new RegExp(`(^|[;{\\s])${slot}\\s*:`).test(clean))
  if (sets.length) return { kind: 'component', why: null, unlayered: sets }

  return {
    kind: 'not-component',
    why: inLargenLayer
      ? 'declares inside a cascade layer other than `largen.components` — framework, library or system CSS'
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

  /* --- 4b. --pad written in rem loses the size axis ------------------------
   *
   * `--scale` inherits and components multiply their `--font-size` by it. Padding
   * in `em` is relative to that font-size, so it scales too, for free. Padding in
   * `rem` is absolute and simply does not:
   *
   *     --pad: 0.5em 1em          data-size sm -> xl:  7px 14px -> 10px 20px
   *     --pad: var(--space-2) …                        8px 16px ->  8px 16px
   *
   * Measured, not assumed. The failure is invisible — the type grows, the box
   * does not, and the page looks deliberate — and it is the mistake a spacing
   * scale invites, because reaching for the scale you were just handed is the
   * obvious move. An agent given the scale and told the rule in prose did this in
   * eight places on its first attempt, which is why this is a check and not a
   * paragraph.
   *
   * A WARNING rather than an error. Fixed padding is sometimes exactly right, and
   * a finding that a correct choice cannot clear is a loop that cannot exit. Only
   * `--pad` is reported: `--gap` is legitimately absolute at the pattern level,
   * which is what the scale is for. */
  lines.forEach((line, i) => {
    const m = line.match(/(?:^|[;{\s])--pad\s*:\s*([^;}]+)/)
    if (!m) return
    const value = m[1]
    const rem = /\b[\d.]+rem\b/.test(value) || /var\(\s*--space-/.test(value)
    if (!rem) return
    add('pad-in-rem', 'warning', at(i),
      '`--pad` is set in rem, so it will not respond to `data-size`',
      'A component multiplies its `--font-size` by `--scale`, and padding in `em` ' +
      'follows that font-size — sm to xl takes `0.5em 1em` from 7px 14px to ' +
      '10px 20px. In rem it stays 8px 16px at every size: the type grows and the ' +
      'box does not. Use `em` for a component\'s own padding and keep `--space-*` ' +
      'for the rhythm between things, which should not resize. If the fixed ' +
      'padding is deliberate, this is a note rather than a fault.\n\n' +
      'This is a heuristic and cannot be more than one. Whether padding should ' +
      'respond to `data-size` depends on where the element sits at runtime, which ' +
      'no stylesheet contains — a narrowing that only warned when the rule also ' +
      'set `--font-size` was measured against two real pages and cleared the ' +
      'broken one as readily as the correct one. `largen probe --size-axis` ' +
      'renders the page under two sizes and is authoritative where they disagree. ' +
      'It also catches what this cannot: `em` padding still will not move unless ' +
      'something multiplies `--font-size` by `var(--scale)`, so a component can ' +
      'pass this rule and sit outside the size axis entirely.')
  })

  /* --- 4c. a gradient routed through a paint slot -------------------------
   *
   * `--bg` drives `background-color`, which does not accept an image value. The
   * declaration is dropped and the element paints nothing — no warning, no
   * fallback, an invisible surface. It has been failure mode #9 in the contract
   * for a release and had no check behind it, which is the shape of the whole
   * finding this rule belongs to: the one composition topic that changed a real
   * page was the one a rule could fail on.
   *
   * The other image-valued slots are not affected: --shadow, --transition and
   * the border slots all take what they are given. Only the two colour slots
   * resolve to a <color>, and --fg with a gradient is rare enough that flagging
   * it too costs nothing. */
  lines.forEach((line, i) => {
    const m = line.match(/(?:^|[;{\s])(--bg|--fg)\s*:\s*([^;}]+)/)
    if (!m) return
    if (!/\b(linear|radial|conic|repeating-linear|repeating-radial|repeating-conic)-gradient\s*\(/.test(m[2])) return
    const prop = m[1]
    const paints = prop === '--bg' ? 'background-color' : 'color'
    add('slot-gradient', 'warning', at(i),
      `\`${prop}\` is set to a gradient, and \`${paints}\` cannot take one`,
      `\`${prop}\` drives \`${paints}\`, which resolves to a <color>. A gradient is ` +
      'an image, so the declaration is dropped and the element paints nothing at ' +
      'all — silently, with no fallback. Write the slot, then the plain property ' +
      'beside it: `--bg: var(--canvas); background-image: radial-gradient(…, ' +
      'var(--shade), transparent)`. The slot keeps tone, variant and theme ' +
      'reaching the element; the plain declaration adds what has no slot. Keep ' +
      'every colour stop on a token — a literal in a gradient is still a literal ' +
      'and cannot follow a theme.')
  })

  /* --- 4d. layout that a shipped utility already does ----------------------
   *
   * `.row` is `display:flex` + `align-items:center` + `--gap`. `.cluster` is the
   * same plus `flex-wrap`. A rule that writes those by hand is not wrong, but it
   * has left the algebra: `gap` written directly is no longer `--gap`, so it is
   * no longer a slot and nothing downstream can reach it.
   *
   * A bake-off arm used `.row` five times and then hand-wrote this ten more
   * times, with fifteen `align-items` beside it, because the compact contract
   * listed seven utility names and nothing else. The documentation is the fix;
   * this is the check that says whether the documentation worked.
   *
   * `info`, not `warning`. Hand-writing flex is legitimate — a `space-between`
   * header, a `flex: 1 1 auto` child — and a finding a correct choice cannot
   * clear is a loop that cannot exit. It names the utility because a suggestion
   * that does not say what to use instead is not actionable, and it only names
   * one when the match is unambiguous. */
  for (const m of region.matchAll(/\{([^{}]*)\}/g)) {
    const block = m[1]
    if (!/(?:^|[;{\s])display\s*:\s*flex\b/.test(block)) continue
    /* Only when the rule is doing what a utility does: flex plus alignment or a
       gap. Bare `display:flex` with custom children is nobody's `.row`. */
    const aligns = /(?:^|[;{\s])align-items\s*:/.test(block)
    const gaps = /(?:^|[;{\s])gap\s*:/.test(block)
    if (!aligns && !gaps) continue
    const wraps = /(?:^|[;{\s])flex-wrap\s*:\s*wrap\b/.test(block)
    const column = /(?:^|[;{\s])flex-direction\s*:\s*column\b/.test(block)
    const utility = column ? 'stack' : wraps ? 'cluster' : 'row'
    const line = region.slice(0, m.index).split('\n').length
    add('layout-by-hand', 'info', line,
      `this is \`.${utility}\` — largen ships it`,
      `\`.${utility}\` already does this, and is configured by \`--gap\` plus ` +
      '`data-align` / `data-justify` rather than by more declarations. Writing it ' +
      'by hand leaves the algebra: `gap` set directly is not `--gap`, so it stops ' +
      'being a slot and nothing can reach it — no tone, no size, no override. ' +
      'Legitimate exceptions exist (a `space-between` bar, a child that needs its ' +
      'own `flex`), which is why this is a hint and not a fault.')
  }

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

  /* --- 7 and 8. Two SHALL NOTs that had no check behind them ---------------
   *
   * The contract has forbidden dark-mode rules and hand-written size variants
   * since `component-authoring` was written, and until now nothing enforced
   * either. The existing checks are value-based — a dark block was only caught
   * when a colour literal happened to sit inside it — so a component written
   * entirely with tokens passed clean:
   *
   *     @media (prefers-color-scheme: dark) { .x { --bg: var(--surface) } }
   *     .x--lg { --pad: var(--pad-5); --font-size: var(--text-lg) }
   *
   * Zero findings, both of them non-conformant. These two checks look at
   * STRUCTURE instead, so the values are irrelevant and the token-written
   * spelling is caught for the same reason the literal one is.
   *
   * Errors from the first release that carries them, not warnings: they enforce
   * rules that already existed, so a component they flag was always
   * non-conformant and the fix is a linter defect correction rather than a new
   * demand. Staging them would re-open the gap the bake-off measured — that
   * guidance without a check does not change what an agent writes.
   *
   * WHY THESE TWO READ THE WHOLE SHEET and the other content rules read only the
   * component region: a dark block written AFTER the components layer closes is
   * the commonest spelling of the mistake, and the region ends at that closing
   * brace. The protection the region gave — not judging a theme by component
   * rules — is supplied here by classifySheet instead, which is a better test
   * anyway: a theme setting tokens under `[data-theme="dark"]` is not a
   * component and never reaches these checks at all. */
  if (classifySheet(css, slots).kind === 'component') {
    const lineAt = (index) => clean.slice(0, index).split('\n').length

    const WHY_DARK =
      'Dark mode in largen is a token swap, not a component concern: `--tone-soft` ' +
      'and `--tone-ink` resolve against `--canvas` and `--ink`, so eleven token ' +
      'overrides in a theme carry every component with them. A component that ' +
      'writes its own dark rule stops following the theme — it will not respond to ' +
      '`data-theme` on a subtree, and it will fight the theme that does. If a ' +
      'component seems to need one, the algebra has failed to cover something and ' +
      'that failure is the bug; the dark rule would only hide it. Put the values in ' +
      'a theme, under `[data-theme="…"]`, in a stylesheet that sets tokens and ' +
      'nothing else.\n\n' +
      'This is a structural check: it does not look at the values, so writing the ' +
      'block entirely with tokens does not clear it.'

    for (const m of clean.matchAll(/@media[^{}]*\(\s*prefers-color-scheme\s*:\s*([\w-]+)\s*\)[^{}]*\{/g)) {
      add('dark-rule', 'error', lineAt(m.index),
        `a component must not carry its own dark-mode rule: \`@media (prefers-color-scheme: ${m[1]})\``,
        WHY_DARK)
    }
    eachRule(clean, (selector, block, index) => {
      const scope = selector.match(/\[data-theme[^\]]*\]/)
      if (!scope) return
      add('dark-rule', 'error', lineAt(index),
        `a component must not scope itself to a theme: \`${scope[0]}\``,
        WHY_DARK)
    })

    /* The heuristic is deliberately narrow: a size-axis suffix in the BEM
       modifier spelling, or a `data-size` scope, AND the rule re-setting a slot
       the size axis already drives. Both halves are required, so a legitimately
       named modifier that sets non-scale slots — `.card--empty` setting `--bg`
       and `--fg` — is not caught, which is the false positive this rule cannot
       afford at error severity. */
    eachRule(clean, (selector, block, index) => {
      const sized = new RegExp(`--(?:${SIZE_VALUES.join('|')})(?![\\w-])`).test(selector) ||
        /\[data-size[^\]]*\]/.test(selector)
      if (!sized) return
      const reset = SCALE_SLOTS.filter((s) => new RegExp(`(^|[;{\\s])${s}\\s*:`).test(block))
      if (!reset.length) return
      add('size-variant', 'error', lineAt(index),
        `\`${selector}\` is a hand-written size variant — it re-sets ` +
        reset.map((s) => `\`${s}\``).join(', '),
        'The size axis is one `--scale` multiplier, not a set of per-size rules. ' +
        'Multiply by `var(--scale)` where you set a size, express the rest in `em`, ' +
        'and padding and gap follow type for free at every size — which is why a ' +
        'component never needs a size variant of its own. Five hand-written ones per ' +
        'component is exactly the cost the axis exists to remove, and they do not ' +
        'compose: `data-size` on an ancestor still sets `--scale`, so the two ' +
        'mechanisms now disagree about how big this component is.\n\n' +
        'This is a structural check and does not read the values: re-setting `--pad` ' +
        'from a spacing token is the same variant as re-setting it from a literal. ' +
        'A unit choice inside ONE rule is a different thing and is not this — see ' +
        'the `pad-in-rem` note for that.')
    })
  }

  /* --- 9. A coined tag that impersonates a native element ------------------
   *
   * `<notification>` renders styled and inert: no role, no accessible name, and
   * `display: inline` from the UA until the component says otherwise. For a
   * container that is merely a name, and largen's own examples use it. For
   * anything with an interactive or landmark role it is a real accessibility
   * defect, and nothing in the mechanism asks for it — a class on a native
   * element works identically, through the same slots.
   *
   * So: a coined tag is for containers with no interactive or landmark role;
   * otherwise use the native element, or say the role out loud.
   *
   * Reported once per name rather than once per rule. The advice does not vary
   * by line, and a component with `button-primary`, `button-primary:hover` and
   * `button-primary[data-variant]` should not say it three times. */
  const coined = new Set()
  eachRule(region, (selector, block, index) => {
    for (const m of selector.matchAll(/(?:^|[\s,>+~(])([a-z][a-z0-9]*(?:-[a-z0-9]+)+)(?![\w-])/g)) {
      const native = nativeElementFor(m[1])
      if (!native || coined.has(m[1])) continue
      coined.add(m[1])
      add('coined-tag', COINED_TAG_SEVERITY, region.slice(0, index).split('\n').length,
        `\`<${m[1]}>\` coins a tag where the native \`<${native}>\` exists`,
        `A coined tag carries no semantics: \`<${m[1]}>\` has no role, no accessible ` +
        'name, and is `display: inline` until something sets otherwise — assistive ' +
        `technology sees a span. The name says this is a \`<${native}>\`, so make it ` +
        `one: \`<${native} class="${m[1]}">\` styles identically, because largen ` +
        'paints from slots and a class fills them exactly as a tag does. If it must ' +
        'be a custom element, say the role out loud with `role=` and add the focus ' +
        'and keyboard behaviour the native element would have brought. A coined tag ' +
        'is for a container with no interactive or landmark role — `<notification>` ' +
        'is fine; this is not.')
    }
  })

  return { ok: findings.filter((f) => f.severity === 'error').length === 0, findings }
}

export default lintComponentCss

/* --- the page, not the stylesheet ----------------------------------------
 *
 * Section rhythm is the one composition claim that is not a property of any
 * stylesheet. "A page whose sections butt together reads as unfinished however
 * good each section is" is about the relationship between a container and its
 * children, and the container is in the HTML.
 *
 * So this takes the document. `verify --entry index.html` already reads one for
 * its <link> order; this is the second use of the same file.
 *
 * Tested against the three bake-off runs on disk before being written: the run
 * that visibly lacked rhythm fires, and the two that had it clear. Three is a
 * small sample and this is a hint accordingly — it cannot see a page that spaces
 * its sections some other legitimate way, only that it did not use the obvious
 * one.
 */
export function lintPageHtml(html, { css = '' } = {}) {
  const findings = []
  const add = (rule, severity, line, message, why) =>
    findings.push({ rule, severity, line, message, why })

  const body = html.match(/<body\b([^>]*)>([\s\S]*)<\/body>/i)
  if (!body) return { ok: true, findings }
  const [, bodyAttrs, inner] = body

  /* Top-level sections only. A nested <section> is not a page section, and
     counting it would fire on any page with a rich single section. */
  let depth = 0
  let sections = 0
  for (const m of inner.matchAll(/<(\/?)(section|main|header|footer|article|div)\b[^>]*?(\/?)>/gi)) {
    const closing = m[1] === '/'
    const selfClosing = m[3] === '/'
    const tag = m[2].toLowerCase()
    if (!closing && depth === 0 && /^(section|main|article|header|footer)$/.test(tag)) sections++
    if (selfClosing) continue
    depth += closing ? -1 : 1
    if (depth < 0) depth = 0
  }
  if (sections < 3) return { ok: true, findings }

  /* Either lever counts. A `stack` on the body is the documented way; setting
     --gap on body or a wrapper in CSS is equally correct and more explicit. */
  const stacked = /\bclass\s*=\s*["'][^"']*\b(stack|grid)\b/i.test(bodyAttrs)
  const inlineGap = /--gap\s*:/.test(bodyAttrs)
  const cssGap = /(?:^|[\s,>+~])(?:body|html)[^{}]*\{[^{}]*--gap\s*:/m.test(strip(css))
  if (stacked || inlineGap || cssGap) return { ok: true, findings }

  add('section-rhythm', 'info', null,
    `${sections} top-level sections and nothing setting the space between them`,
    'Padding a section does nothing for the gap after it — two padded sections ' +
    'still butt together, and a page whose sections touch reads as unfinished ' +
    'however good each one is. Set the rhythm on the container: `<body ' +
    'class="stack" style="--gap: var(--space-24)">`, or set `--gap` on body in ' +
    'CSS. This is a hint because a page can space its sections another way; it ' +
    'means the obvious lever is unused, not that the page is wrong.')

  return { ok: true, findings }
}
