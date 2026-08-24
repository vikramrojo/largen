/* largen — the authoring contract, as one structured source.
 *
 * The contract used to be restated in three places (skill/SKILL.md, README.md,
 * and build-largen's design.md). Adding /llms.txt and a get_contract tool would
 * have made five, and five copies of a rule is four copies of a future
 * inconsistency. This file is the source; every other surface is generated from
 * it by `largen contract`.
 *
 * Two things are deliberately NOT restated here, because restating them is the
 * failure mode this file exists to prevent:
 *
 *   slots  are parsed out of src/properties.css, which is the actual @property
 *          registration. Parsing the real thing makes drift impossible.
 *   axes   carry their prose here, but their VALUES come from
 *          genai/manifest.json and are cross-checked by assertAxesAgree().
 *          manifest.json is a different artifact — a per-project allowlist whose
 *          `components` array projects replace — so it cannot simply BE the
 *          contract, but it must never disagree with it either.
 *
 * Every rule carries a `why`. A generator that flattened this into a table of
 * names and values would strip out the part that actually teaches, which is the
 * risk the design flags by name.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')

/* --- Slots: parsed, never restated ---------------------------------------- */

/** Every `@property` registration in src/properties.css, split by whether it
 *  inherits. The non-inheriting ones are the slots a component sets; the
 *  inheriting ones are the half of the system a modifier class cannot express. */
export function readSlots() {
  const props = strip(read('src/properties.css'))
  const fixed = [], inheriting = []
  for (const m of props.matchAll(/@property\s+(--[\w-]+)\s*\{([^}]*)\}/g)) {
    const [, name, body] = m
    ;(/inherits:\s*true/.test(body) ? inheriting : fixed).push(name)
  }
  if (!fixed.length) throw new Error('no slots parsed from src/properties.css')
  return { fixed, inheriting }
}

/** The universal paint rule, verbatim.
 *
 *  Printed rather than described because describing it is not enough: a reader
 *  working from the prose alone reconstructed it as `:where(*)` with a
 *  `background` shorthand, when it is a bare `*` setting `background-color`. Both
 *  differences matter — the shorthand would reset background-image, and the
 *  `:where()` is unnecessary because `*` contributes no specificity anyway. */
export function readPaintRule() {
  const paint = strip(read('src/paint.css'))
  const m = paint.match(/@layer\s+largen\.paint\s*\{([\s\S]*)\}/)
  if (!m) throw new Error('could not find the paint layer in src/paint.css')
  return m[1].replace(/^\n+|\s+$/g, '').replace(/^ {2}/gm, '')
}

/** The @property registrations, verbatim. */
export function readPropertyBlocks() {
  const props = strip(read('src/properties.css'))
  const lines = [...props.matchAll(/@property[^{]*\{[^}]*\}/g)].map((m) => m[0].replace(/\s+/g, ' '))
  if (!lines.length) throw new Error('no @property declarations in src/properties.css')
  return lines
}

/** The tone derivations are computed in src/algebra.css rather than registered,
 *  so they are not @property declarations and must be read from there. */
export function readToneDerivations() {
  const algebra = strip(read('src/algebra.css'))
  const names = new Set()
  for (const m of algebra.matchAll(/(--tone-[\w-]+)\s*:/g)) names.add(m[1])
  return [...names].sort()
}

/** The declared layer order, read from the @layer statement itself. */
export function readLayerOrder() {
  const decl = strip(read('src/largen.css')).match(/@layer\s+([^;]+);/)
  if (!decl) throw new Error('no @layer statement in src/largen.css')
  return decl[1].split(',').map((s) => s.trim()).filter(Boolean)
}

/* --- Axes: prose here, values from the manifest --------------------------- */

const AXIS_PROSE = {
  tone: {
    attribute: 'data-tone',
    inherits: true,
    summary: 'Which semantic colour a component speaks in.',
    why:
      'Tone inherits, and that is the point rather than a convenience: ' +
      '`<section data-tone="danger">` re-tones every component inside it with no ' +
      'per-child markup. A component never names a colour; it names `var(--tone)` ' +
      'and its derivations, and the theme decides what that resolves to.',
  },
  variant: {
    attribute: 'data-variant',
    inherits: false,
    summary: 'How the tone is applied as a fill.',
    why:
      'Derived from the tone, never a separate colour. It deliberately does NOT ' +
      'inherit: with a universal paint rule there is no marker separating a ' +
      'component from a bare `<span>`, so a subtree variant would paint every ' +
      'wrapper element it passed through.\n\n' +
      'This axis is optional, and that is worth saying because the other three ' +
      'are not. The four variants are *ways of applying a tone*. If a component\'s ' +
      'variations are a surface treatment rather than a tone — a hairline in ' +
      '`--line` over `--canvas`, say — routing them through `data-variant` will ' +
      'tint the border and the label, and you will spend the afternoon fighting ' +
      'it. Write classes instead. Tone, size and state still apply; only this one ' +
      'has a premise your component can fail to meet.',
  },
  size: {
    attribute: 'data-size',
    inherits: true,
    summary: 'One multiplier scaling type, padding and gap together.',
    why:
      'A single `--scale` multiplier, not a set of per-size rules. Multiply by ' +
      '`var(--scale)` where you set a size and express everything else in `em`, ' +
      'and padding follows type for free. This is why a component never needs a ' +
      'size variant of its own.',
  },
  state: {
    attribute: null,
    inherits: null,
    values: [':disabled', ':user-invalid', ':read-only', ':focus-visible'],
    summary: 'Real DOM state, not an authored attribute.',
    why:
      'State comes from the DOM and from real HTML attributes. It is not settable ' +
      'through the generative-UI manifest and should never be simulated with a ' +
      'class, because the browser already knows the answer.',
  },
}

/* --- The rules ------------------------------------------------------------ */

export const RULES = [
  {
    id: 'layer',
    title: 'Author inside `@layer largen.components`. Override from outside it.',
    why:
      'Unlayered CSS beats every layer. That is what makes overriding largen work ' +
      "without `!important` — and it is exactly what breaks an unlayered " +
      '*component*: it outranks `largen.modifiers`, so `data-variant` silently ' +
      "stops applying while tone and size keep working. If a variant \"isn't " +
      'applying", check this before anything else.',
    example:
      '@layer largen.components {\n' +
      '  .notification, notification {\n' +
      '    --bg: var(--tone-soft);\n' +
      '    --fg: var(--tone-ink);\n' +
      '    --pad: .75em 1em;\n' +
      '  }\n' +
      '}',
  },
  {
    id: 'slots-not-colours',
    title: 'A component sets slots. It does not set colours.',
    why:
      'Write `--bg: var(--tone-soft)`, never `--bg: #fee`, and never ' +
      '`--bg: var(--danger)`. A colour literal cannot follow a theme swap, and ' +
      'reaching past `--tone*` to a raw semantic token breaks tone inheritance — ' +
      'the component pins itself to one colour and stops responding to the ' +
      '`data-tone` on its container. `largen verify` enforces both.',
  },
  {
    id: 'no-dark-rule',
    title: 'Never write a dark-mode rule.',
    why:
      '`--tone-soft` and `--tone-ink` resolve against `--canvas` and `--ink`, so a ' +
      'theme swap carries every component with it. If a component seems to need a ' +
      'dark-mode rule, the algebra has failed to cover something and *that* is the ' +
      'bug worth fixing — the dark rule would only hide it.',
  },
  {
    id: 'no-size-variant',
    title: 'Never write a size variant.',
    why:
      'Multiply by `var(--scale)` where you set a size, express the rest in `em`, ' +
      'and padding follows type automatically. Five hand-written size variants per ' +
      'component is the cost the size axis exists to remove.\n\n' +
      'The rule is about not writing the same component five times. It is not a ' +
      'rule about units, and the distinction matters for the shape it appears to ' +
      'forbid: a control that shrinks its box while holding its type at one size. ' +
      '`em` is what couples padding to type; `rem` is what decouples them. Set ' +
      '`--pad` in `rem` and the box stops following the size axis while the type ' +
      'keeps up with it. Measured at `data-size="lg"`: padding in `em` grows from ' +
      '16px to 18px, padding in `rem` stays at 12.8px. That is a unit choice ' +
      'inside one component, not a size variant.',
  },
  {
    id: 'html-first',
    title: 'Reach for HTML first.',
    why:
      '`<dialog>` is the modal, `<details>` is the collapse. Both are already themed ' +
      'by `largen.elements`. Reimplementing focus trapping or open-state management ' +
      'in CSS and JS buys nothing the platform has not already shipped and tested.',
  },
  {
    id: 'no-initial-value',
    title: 'Never add an `initial-value` to a slot.',
    why:
      'With universal syntax, omitting `initial-value` makes an unset slot the ' +
      '*guaranteed-invalid* value, so `var(--pad, revert-layer)` falls back and ' +
      'hands the property back to the UA stylesheet untouched. Add an initial ' +
      'value and the slot is never unset, the fallback never fires, and the ' +
      "universal paint rule resets every element's UA defaults — every `<ul>` " +
      'loses its indent and every `<h1>` its size. This descriptor is the reason ' +
      'largen needs no build step.\n\n' +
      'One registered property does carry an initial value, deliberately: ' +
      '`--scale` is declared `initial-value: 1`. It is not a paint slot — nothing ' +
      'reads it through `var(--scale, revert-layer)` — but a multiplier that every ' +
      'size calculation depends on, so it must always resolve to a number. ' +
      '`largen verify` exempts it by name for exactly this reason. The rule holds ' +
      'for the paint slots without exception.',
  },
]

/* --- How it fails --------------------------------------------------------- */

/* Composition — the half the contract did not have.
 *
 * Everything else here is mechanism or prohibition: what the paint rule does,
 * which layer to author in, what not to hardcode. There was a "how it fails" and
 * no "how it looks good", and a page built to the rules alone comes out correct
 * and plain — measured, not supposed: the same brief through the same model
 * produced a page that passed every check and had no rhythm, no elevation and
 * unreadable text on a toned surface. Adding this material and changing nothing
 * else fixed all three.
 *
 * None of it changes a rule. Every line is expressible in the algebra already. */
export const COMPOSITION = {
  space: {
    title: 'Space is a scale, and the unit carries meaning',
    body:
      'Use `--space-1` … `--space-24` for the rhythm BETWEEN things: section gaps, ' +
      'page padding, the distance from a heading to what it introduces. They are ' +
      'rem, because a gap between two sections should not grow when a component ' +
      'inside one carries `data-size="lg"`.\n\n' +
      "Use `em` for a component's OWN padding. `--scale` inherits and a component " +
      'multiplies its `--font-size` by it, so `em` padding follows: `0.5em 1em` is ' +
      '7px 14px at `sm` and 10px 20px at `xl`. The same padding as `var(--space-2) ' +
      'var(--space-4)` is 8px 16px at every size — the type grows, the box does ' +
      'not, and nothing looks wrong. `largen verify` reports it.\n\n' +
      'Sections need space between them, not only inside them. Padding a hero does ' +
      'nothing for the gap after it: `<body class="stack" style="--gap: ' +
      'var(--space-24)">`. A page whose sections butt together reads as unfinished ' +
      'however good each section is.',
  },
  elevation: {
    title: 'Elevation exists',
    body:
      '`--shadow` is a slot and two tokens already fill it: `--lift-1` ' +
      '(`0 1px 2px var(--shade)`) for resting surfaces, `--lift-2` ' +
      '(`0 8px 28px var(--shade-strong)`) for the one thing you want picked out.\n\n' +
      'Restraint is the whole of it. If everything is raised, nothing is. A ' +
      'recommended pricing tier earns `--lift-2`; the tiers either side earn ' +
      '`--lift-1` or nothing.',
  },
  beyond: {
    title: 'What a slot cannot express',
    body:
      'Fourteen slots do not cover everything, and the ones they miss fail ' +
      'silently rather than loudly. A gradient is the common one: `--bg` drives ' +
      '`background-color`, so `--bg: linear-gradient(…)` paints nothing.\n\n' +
      'Write the slot, then the plain property:\n\n' +
      '    .hero {\n' +
      '      --bg: var(--tone);\n' +
      '      background-image: linear-gradient(160deg, transparent, var(--shade-strong));\n' +
      '    }\n\n' +
      'The slot keeps the element inside the algebra — tone, variant and theme ' +
      'still reach it — and the plain declaration adds what has no slot. Note the ' +
      'gradient stop is a token: a literal there is still a literal, and `verify` ' +
      'will say so.',
  },
  contrast: {
    title: 'Text on a toned surface takes its colour from the tone',
    body:
      'A muted grey that reads well on `--canvas` can be almost invisible on ' +
      '`--tone-soft`, and it lands on exactly the element you most want read — a ' +
      'price suffix, a caption, a label. On a toned surface use ' +
      '`--fg: var(--tone-ink)` or `var(--tone-contrast)`. Keep `--ink-muted` for ' +
      'the untoned page.',
  },
  restraint: {
    title: 'Loud is relative',
    body:
      'If the hero is to be the loudest thing, the rest of the page has to be ' +
      'quiet: one accent used sparingly, one step between resting and raised, one ' +
      'type scale, generous and CONSISTENT space.\n\n' +
      'Detail earns its place. A nav, an eyebrow above the headline, an icon tile, ' +
      'a ribbon on the recommended tier — each is fine and all of them together is ' +
      'noise. Choose two or three.',
  },
}

export const FAILURE_MODES = [
  {
    symptom: 'A gradient set through `--bg` produces no background at all.',
    cause: '`--bg` drives `background-color`, which cannot take a gradient.',
    fix: 'Keep the slot and write the gradient beside it: `--bg: var(--tone); background-image: linear-gradient(…)`.',
    why:
      'The declaration is dropped and the element paints transparent, with no ' +
      'warning anywhere. Nothing about `--bg` says "colour only" — it is named for ' +
      'background, and every other slot takes whatever its property takes. This is ' +
      'the general shape for anything the algebra does not model: write the slot, ' +
      'then the plain property. The slot keeps the element inside the algebra; the ' +
      'plain declaration adds what has no slot.',
  },
  {
    symptom: 'Type resizes with `data-size` and the padding around it does not.',
    cause: 'The component\'s `--pad` is written in `rem` — often `var(--space-*)` — instead of `em`.',
    fix: 'Use `em` for a component\'s own padding. Keep `--space-*` for the rhythm between things.',
    why:
      '`--scale` inherits and a component multiplies its `--font-size` by it. ' +
      'Padding in `em` is relative to that font-size and follows it: `0.5em 1em` ' +
      'goes from 7px 14px at `sm` to 10px 20px at `xl`. In rem it is 8px 16px at ' +
      'every size. The page looks deliberate and has lost an axis. Reaching for the ' +
      'spacing scale is the obvious move, which is why `largen verify` reports this ' +
      'rather than leaving it to the eye.',
  },
  {
    symptom: '`data-variant` has no effect, but `data-tone` and `data-size` still work.',
    cause: 'The component is declared outside `@layer largen.components`.',
    fix: 'Wrap the component rule in `@layer largen.components { … }`.',
    why:
      'This is the worst failure mode in the system because it looks like it works. ' +
      'An unlayered component outranks `largen.modifiers`, so the variant rules lose ' +
      '— but tone and size act through inheriting custom properties rather than by ' +
      'overriding slots, so they are unaffected. One dead axis and two live ones ' +
      'reads as "variant is buggy" rather than "my component is in the wrong layer".',
  },
  {
    symptom: 'A component ignores the `data-tone` on its container.',
    cause: 'It reaches past `--tone*` to a raw semantic token, e.g. `--bg: var(--danger)`.',
    fix: 'Use `var(--tone)`, `var(--tone-soft)`, `var(--tone-ink)` or `var(--tone-line)`.',
    why:
      'Raw semantic tokens are absolute; the `--tone*` family is relative to whatever ' +
      'tone is in scope. Naming the absolute one opts the component out of the axis ' +
      'entirely, which is invisible until someone sets a tone on an ancestor.',
  },
  {
    symptom: 'Every element on the page loses its browser defaults — lists unindent, headings shrink.',
    cause: 'A slot was given an `initial-value`, or `paint.css` was moved out of its layer.',
    fix: 'Remove the `initial-value`; keep the universal rule inside `@layer largen.paint`.',
    why:
      '`revert-layer` is only meaningful from inside a layer, and only reached when the ' +
      'slot is guaranteed-invalid. Break either condition and the one universal rule ' +
      'stops being inert and starts being destructive.',
  },
  {
    symptom:
      'Your own CSS is inside a cascade layer, and largen still wins — or your ' +
      '"base" layer beats largen when you meant it to lose.',
    cause:
      'A layer\'s position is fixed the first time it is mentioned, and a ' +
      'sublayer inherits its parent\'s position. Layers largen named first keep ' +
      'theirs; yours are appended after them, whatever order your `@layer` ' +
      'statement lists.',
    fix:
      'Declare every layer in one statement, before largen loads, with flat ' +
      'names on both sides of it:\n\n' +
      '    @layer app-base,\n' +
      '           largen.reset, largen.tokens, largen.paint, largen.tone,\n' +
      '           largen.elements, largen.components, largen.modifiers,\n' +
      '           app-overrides;',
    why:
      'Writing `@layer app.base, largen.components, app.overrides;` reads as ' +
      '"app.base lowest, app.overrides highest" and does not do that. ' +
      '`largen.components` already exists and keeps its position, while the new ' +
      '`app` parent is appended after everything — so `app.base` outranks largen ' +
      'and `app.overrides` can never reach past it, because both are children of ' +
      'one parent that has one position. Flat names avoid it: `app-base` and ' +
      '`app-overrides` are independent, so they can sit on either side.\n\n' +
      'This is also where a preflight goes when largen runs alongside another ' +
      'framework — put its base layer in the statement ahead of largen, or it ' +
      'sorts last and flattens everything largen styled. Layer order beats ' +
      'specificity, so no amount of selector weight recovers it.\n\n' +
      '`largen verify` cannot catch this. Layer position is a property of the ' +
      'whole document at load time — which files were seen, in what order — and ' +
      'a linter reading one stylesheet has no way to know. The browser is the ' +
      'only place the answer exists.',
  },
  {
    symptom:
      'A fill is the right colour and the text on it is unreadable — the old ' +
      'tone\'s contrast colour on the new tone\'s background.',
    cause:
      'The component set `--tone` and read `var(--tone-contrast)` without setting ' +
      '`--tone-contrast` alongside it.',
    fix: 'Set the pair together: `--tone: var(--danger); --tone-contrast: var(--danger-on)`.',
    why:
      '`--tone-soft`, `--tone-ink` and `--tone-line` are formulas, and largen ' +
      'recomputes them on every element, so setting `--tone` anywhere is enough ' +
      'for those. `--tone-contrast` is not a formula — it is the paired token ' +
      '(`--danger` pairs with `--danger-on`) and nothing can derive one from the ' +
      'other, so it keeps whatever value was already in scope. The three that ' +
      'follow `--tone` automatically are exactly the three that can be computed ' +
      'from it. `largen verify` and `check_component_css` both flag this.',
  },
  {
    symptom:
      'largen is painting something you want it to leave alone — a third-party ' +
      'widget, a chart, markup another framework owns.',
    cause:
      'The universal paint rule claims a property as soon as any rule sets its ' +
      'slot, and nothing "unsets" a custom property by writing an empty value.',
    fix: 'Set the slot to `initial`: `--bg: initial; --pad: initial`.',
    why:
      'A slot is registered with universal syntax and no `initial-value`, so ' +
      '`initial` returns it to the *guaranteed-invalid* value — the state it has ' +
      'when nothing has set it. `var(--bg, revert-layer)` then fires and hands the ' +
      'property back to the user-agent stylesheet untouched. Measured: a claimed ' +
      'element computes `rgb(244,245,247)` and `16px` of padding; the same element ' +
      'with the slots set to `initial` computes `rgba(0,0,0,0)` and `0px`.\n\n' +
      'This is the mechanism that makes incremental adoption possible. It is how ' +
      'largen can run beside another framework for as long as a migration takes, ' +
      'releasing whatever the other one still owns, rather than requiring a ' +
      'cutover. Treat it as a first-class part of the contract, not a trick.',
  },
  {
    symptom:
      'A link is tinted with the tone when it should take the colour of the text ' +
      'around it.',
    cause:
      '`largen.elements` sets `--fg: var(--tone-ink)` on every `a`, which is right ' +
      'for prose links and wrong for links that are navigation or UI.',
    fix: 'Set `--fg: currentColor` on the link component. `color: inherit` is equivalent.',
    why:
      'The spelling that looks right is `--fg: inherit`, and it does something ' +
      'else. `inherit` takes the parent\'s computed `--fg`, and because the slot ' +
      'does not inherit and the parent never set it, that value is ' +
      'guaranteed-invalid — so `var(--fg, revert-layer)` fires and reverts to the ' +
      '**user-agent** stylesheet, which colours links blue. Measured against a ' +
      'parent at `rgb(3,4,5)`: `inherit` gives `rgb(0,0,238)`, `currentColor` ' +
      'gives `rgb(3,4,5)`.\n\n' +
      'The general lesson is worth more than the recipe: returning a slot to ' +
      'guaranteed-invalid gets you the user-agent value, never the ambient one. ' +
      'If you want what the surroundings have, name it — `currentColor` — rather ' +
      'than trying to get there by removal.',
  },
  {
    symptom: 'A component looks right in one theme and wrong in the other.',
    cause: 'A colour literal, or a value that does not resolve against `--canvas`/`--ink`.',
    fix: 'Route the colour through a token or a `--tone*` derivation.',
    why:
      'Theme swapping works by changing what the tokens resolve to. Anything that ' +
      'bypasses the tokens is simply not part of that mechanism.',
  },
]

/* --- Narrative -----------------------------------------------------------
 *
 * These live here rather than in the generator for the same reason everything
 * else does: a generator that carried its own prose would be a second source of
 * the contract wearing a different hat.
 */

export const OVERVIEW = {
  tagline: 'A property algebra for CSS. Plain CSS — no build step, no preprocessor, no plugin.',
  model:
    'TOKENS      --canvas --ink --surface --line, --primary/--primary-on …   theme sets these\n' +
    'SLOTS       --bg --fg --pad --gap --radius --font-size …                library, fixed\n' +
    'AXES        tone · variant · size · state                               library, fixed\n' +
    'PAINT       one universal rule                                          library, fixed\n' +
    '─────────────────────────────────────────────────────────────────────────────────────\n' +
    'UTILITIES   stack row cluster center grid switcher sidebar              library, fixed\n' +
    '─────────────────────────────────────────────────────────────────────────────────────\n' +
    'COMPONENTS  whatever this project needs                                 ← YOU WRITE THESE',
  why:
    'Only the last row grows. A component is about six lines because everything ' +
    'above it is already solved — the tones, the variants, the sizes, the states ' +
    'and both themes are supplied by the rows it never mentions.',
  example: {
    css:
      '@layer largen.components {\n' +
      '  .notification, notification {\n' +
      '    --bg: var(--tone-soft);\n' +
      '    --fg: var(--tone-ink);\n' +
      '    --border-width: 0 0 0 3px;\n' +
      '    --border-color: var(--tone);\n' +
      '    --border-style: solid;\n' +
      '    --radius: var(--radius-md);\n' +
      '    --pad: .75em 1em;\n' +
      '    --gap: .75em;\n' +
      '    display: grid;\n' +
      '    grid-template-columns: auto 1fr;\n' +
      '    align-items: center;\n' +
      '  }\n' +
      '}',
    html:
      '<notification data-tone="warning">Two accounts need review.</notification>\n' +
      '<div class="notification" data-tone="warning">…same thing…</div>',
    why:
      'That is a complete component: seven tones, four variants, five sizes, every ' +
      'state, both themes — none of which it mentions.',
  },
}

export const COMMANDS = [
  { command: 'npx largen verify [css...] [--entry main.css]', does: "check your components against the contract, and resolve the cascade across your files" },
  { command: 'npx largen eval <dir> [dir2] [--entry main.css] [--json]', does: 'score a directory of authored components against the contract — offline, deterministic, no model' },
  { command: 'npx largen build', does: 'bundle + minify to dist/ — optional, for CDN, no dependencies' },
  { command: 'npx largen gen', does: 'regenerate genai artifacts from genai/manifest.json' },
  { command: 'npx largen manifest <css...>', does: "derive a component manifest from a project's CSS" },
  { command: 'npx largen cascade --property P --at CHAIN <css...>', does: 'which declaration wins for a property on an element, and why — no browser' },
  { command: 'npx largen slot --slot S --at CHAIN <css...>', does: 'whether the paint rule applies a slot, or it reverts, and to what' },
  { command: 'npx largen probe --page URL --select SEL --prop P', does: 'emit a browser harness for what static checks cannot see' },
]

export const COMMANDS_CAVEAT =
  '`verify` lints the files you point it at, or the component stylesheets it finds ' +
  'under the working directory — a stylesheet is a component file when it declares ' +
  'inside `@layer largen.components`, or sets paint slots without using a largen ' +
  'layer at all, which is a component that forgot the layer. Run inside a clone of ' +
  'largen it additionally checks the library\'s own invariants.\n\n' +
  '`cascade` and `slot` take the element as an ancestor chain written like a ' +
  'selector — `--at "html body p.prose kbd"`. A chain carries no siblings and no ' +
  'interaction state, so rules turning on `:hover`, `:last-child`, `:nth-*` or a ' +
  'sibling combinator cannot be decided from it. Those are reported as undecidable ' +
  'rather than dropped, because an omission reads as "no rule here" and any one of ' +
  'them could be the rule that actually wins. `probe` settles those.\n\n' +
  '`verify` also resolves the cascade across your files when it can work out the ' +
  'order they load in — inferred from an entry stylesheet, or given with ' +
  '`--entry`. That is the check that catches a component whose declaration is ' +
  'correct, whose file is correct, and which still never applies because another ' +
  'layer wins. Without an order it says so rather than guessing.\n\n' +
  'What it still cannot see is rendering. It has passed clean on visibly broken components before; ' +
  'render the result in a browser, in both themes.\n\n' +
  '`build` needs nothing installed — it inlines imports, strips comments and ' +
  'squeezes whitespace, which is all this stylesheet requires. If your own CSS ' +
  'wants a real minifier, bring one and point it at your build; largen does not ' +
  'need one and does not ship one.'

export const GENERATIVE_UI =
  '`genai/manifest.json` is the approved-component allowlist; `schema.json` and ' +
  '`prompt.md` are generated from it by `largen gen`. `genai/validate.js` turns a ' +
  'model-emitted node into an attribute bag and rejects anything else. There is no ' +
  'field for a colour, class or handler, so the safety property is structural rather ' +
  'than defensive — the worst a compromised model can do is pick the wrong approved ' +
  "component. Replace the `components` array with the project's own components."

/* --- Assembly ------------------------------------------------------------- */

/** Build the whole contract. Axis values come from the manifest so there is
 *  exactly one list of permitted values in the repository; assertAxesAgree() is
 *  what stops that convenience from becoming a silent second source. */
export function buildContract() {
  const manifest = JSON.parse(read('genai/manifest.json'))
  const slots = readSlots()
  const pkg = JSON.parse(read('package.json'))

  const axes = {}
  for (const [name, prose] of Object.entries(AXIS_PROSE)) {
    axes[name] = {
      attribute: prose.attribute,
      inherits: prose.inherits,
      values: prose.values ?? manifest.axes[name]?.values ?? [],
      summary: prose.summary,
      why: prose.why,
    }
  }

  return {
    version: pkg.version,
    overview: OVERVIEW,
    slots: {
      fixed: slots.fixed,
      registrations: readPropertyBlocks(),
      why:
        'Every component is painted from these and only these. All are registered ' +
        "`inherits: false` with no `initial-value`, so a component's background " +
        'cannot cascade onto its children and an unset slot stays guaranteed-invalid — ' +
        'which is what makes `var(--pad, revert-layer)` hand the property back to the ' +
        'UA stylesheet.',
      /* Two different mechanisms, reported separately. Presenting them as one
         list is what led a reader to conclude the tone family is registered with
         `inherits: true`. It is not registered at all — it inherits because that
         is simply the default for a custom property. */
      inheriting: {
        registered: slots.inheriting,
        ambient: ['--tone', ...readToneDerivations()],
        why:
          '`--scale` is the only *registered* inheriting property: it is declared ' +
          '`@property --scale { syntax: "<number>"; inherits: true; initial-value: 1 }`, ' +
          'so it is type-checked and animatable. `--tone` and its derivations are not ' +
          'registered at all — they inherit because inheritance is the default for a ' +
          'custom property. The distinction matters: only a registered property is ' +
          'checked against a syntax, only a registered property can be transitioned, ' +
          'and only a registered universal property with no initial value becomes ' +
          'guaranteed-invalid when unset.',
      },
    },
    paint: {
      rule: readPaintRule(),
      why:
        'One rule, applied to every element. It is safe universally only because an ' +
        'unset slot is guaranteed-invalid, so `var(…, revert-layer)` fires and hands ' +
        'the property straight back to the UA stylesheet — a `<ul>` keeps its indent, ' +
        'an `<h1>` its size. The selector is a bare `*`, not `:where(*)`: the universal ' +
        'selector already contributes no specificity, so there is nothing to wrap. ' +
        'Note `background-color`, not the `background` shorthand, which would also ' +
        'reset `background-image` and the rest of the family.',
    },
    axes,
    layers: {
      order: readLayerOrder(),
      why:
        '`elements` sits before `components` so a component class beats a bare-element ' +
        "default; `modifiers` sits last so an explicit variant beats a component's own " +
        'default fill. Consumer CSS always wins without `!important` because unlayered ' +
        'author CSS outranks every layer, and because the element and component ' +
        'selectors are `:where()`-wrapped to contribute no specificity. The paint rule ' +
        'is the one that is not wrapped — a bare `*` is already specificity-free.',
    },
    rules: RULES,
    failureModes: FAILURE_MODES,
    composition: COMPOSITION,
    commands: { list: COMMANDS, caveat: COMMANDS_CAVEAT },
    generativeUI: GENERATIVE_UI,
    notes: manifest.notes,
  }
}

/** Fail loudly if the contract and the allowlist disagree about an axis. They
 *  are different artifacts with different jobs, but a value permitted by one and
 *  rejected by the other is always a bug. */
export function assertAxesAgree() {
  const manifest = JSON.parse(read('genai/manifest.json'))
  const problems = []
  for (const name of ['tone', 'variant', 'size']) {
    const mine = AXIS_PROSE[name]
    const theirs = manifest.axes[name]
    if (!theirs) { problems.push(`genai/manifest.json has no "${name}" axis`); continue }
    if (mine.attribute !== theirs.attribute) {
      problems.push(`${name}: attribute is ${mine.attribute} here, ${theirs.attribute} in the manifest`)
    }
    if (mine.inherits !== theirs.inherits) {
      problems.push(`${name}: inherits is ${mine.inherits} here, ${theirs.inherits} in the manifest`)
    }
  }
  if (problems.length) {
    throw new Error('the contract and genai/manifest.json disagree:\n    ' + problems.join('\n    '))
  }
}

export const SECTIONS = ['overview', 'slots', 'paint', 'axes', 'layers', 'rules', 'failureModes',
  'composition', 'commands', 'generativeUI', 'notes']

/** One section of the contract, for `get_contract`'s `section` argument. */
export function getSection(name) {
  const contract = buildContract()
  if (name === undefined || name === null || name === 'all') return contract
  if (!SECTIONS.includes(name)) {
    throw new Error(`unknown section ${JSON.stringify(name)}; expected one of ${SECTIONS.join(', ')}`)
  }
  return { version: contract.version, [name]: contract[name] }
}

export default buildContract
