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
      'variations are a surface treatment rather than a tone, say a hairline in ' +
      '`--line` over `--canvas`, routing them through `data-variant` will ' +
      'tint the border and the label. Write classes instead. Tone, size and ' +
      'state still apply; only this one has a premise your component can fail ' +
      'to meet.',
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
      "without `!important`. It is also exactly what breaks an unlayered " +
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
      'reaching past `--tone*` to a raw semantic token breaks tone inheritance. ' +
      'The component pins itself to one colour and stops responding to the ' +
      '`data-tone` on its container. `largen verify` enforces both.',
  },
  {
    id: 'no-dark-rule',
    title: 'Never write a dark-mode rule.',
    why:
      '`--tone-soft` and `--tone-ink` resolve against `--canvas` and `--ink`, so a ' +
      'theme swap carries every component with it. If a component seems to need a ' +
      'dark-mode rule, the algebra has failed to cover something, and that failure ' +
      'is the bug worth fixing. A dark rule would only hide it.',
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
    id: 'coined-tags',
    title: 'A coined tag is for a container with no role. Otherwise use the element.',
    why:
      '`<notification>` is fine; `<button-primary>` is not: it claims a role it lacks. ' +
      'A coined tag has no role and no accessible name, so assistive technology sees ' +
      'a span. largen paints from slots, so `<button class="button-primary">` styles ' +
      'identically and keeps the role, focus ring and keyboard behaviour. Use the ' +
      'native element, or set `role=`.',
  },
  {
    id: 'no-initial-value',
    title: 'Never add an `initial-value` to a slot.',
    why:
      'With universal syntax, omitting `initial-value` makes an unset slot the ' +
      '*guaranteed-invalid* value, so `var(--pad, revert-layer)` falls back and ' +
      'hands the property back to the UA stylesheet untouched. Add an initial ' +
      'value and the slot is never unset, the fallback never fires, and the ' +
      "universal paint rule resets every element's UA defaults. Every `<ul>` " +
      'loses its indent and every `<h1>` its size. This descriptor is the reason ' +
      'largen needs no build step.\n\n' +
      'One registered property does carry an initial value, deliberately: ' +
      '`--scale` is declared `initial-value: 1`. It is not a paint slot, since ' +
      'nothing reads it through `var(--scale, revert-layer)`. It is a multiplier ' +
      'that every size calculation depends on, so it must always resolve to a ' +
      'number. `largen verify` exempts it by name for exactly this reason. The ' +
      'rule holds for the paint slots without exception.',
  },
  {
    id: 'token-tiers',
    /* Project architecture, not per-component authoring — see llmsCompact(). */
    compact: false,
    title: 'Two token tiers. A palette, if you need one, goes in your theme.',
    why:
      'Larger systems have three tiers: reference (a raw palette, `blue-500`), ' +
      'system (roles, `--primary`), component. largen has two — tokens, which are ' +
      'roles, and slots, which a component fills — and a theme writes values ' +
      'straight into the semantic tokens with no palette between. At this size that ' +
      'is one less indirection to hold in your head, not an omission.\n\n' +
      'A project outgrows it predictably: when one brand palette feeds several ' +
      'themes and the same hex appears in three files. Do not wait for largen to ' +
      'ship a reference tier — put the palette in your own theme, above largen\'s ' +
      'tokens, and point the roles at it: `--brand-blue-60: #1c6fd6; --primary: ' +
      'var(--brand-blue-60)`. largen needs to know nothing about it, because a theme ' +
      'sets largen\'s token names and where it got them is its own business.\n\n' +
      'The placement that does not work is a palette in a component: naming ' +
      '`--brand-blue-60` there pins it to one colour and drops it out of the tone ' +
      'axis, the same mistake as naming `--danger` directly.',
  },
  {
    id: 'no-context-axis',
    /* Project architecture, not per-component authoring — see llmsCompact(). */
    compact: false,
    title: 'Density and direction are not axes. Query for them inside the component.',
    why:
      'The axes are tone, variant, size and state. Some systems add a context ' +
      'dimension — density, form factor, writing direction — and largen does not, ' +
      'now or planned. Said out loud so nobody waits for it: there will be no ' +
      '`data-density`.\n\n' +
      'The escape hatch is ordinary CSS and it is normal. A media or container query ' +
      'INSIDE a component is allowed by every rule here: ' +
      '`@container (inline-size < 30em) { .toolbar { --pad: .5em .75em } }`, beside ' +
      'the component it tightens. That queries the container rather than adding a ' +
      'variant, so it composes with tone, size and state instead of multiplying ' +
      'against them. What it must not become is a size variant: `data-size` already ' +
      'sets `--scale`, and a rule re-setting `--pad` keyed off a size-axis value is ' +
      'what `largen verify` reports.\n\n' +
      'Direction needs nothing. largen is written in logical properties throughout ' +
      '— `padding-inline`, `margin-block`, `inset-inline-start` — so a component ' +
      'built the same way follows `dir="rtl"` with no rule of its own. Reaching for ' +
      '`padding-left` is what breaks it.',
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

/* The layout utilities, with what each one reads.
 *
 * The overview map lists these as seven words, which is enough to know they
 * exist and not enough to use them. A bake-off arm read that line, used `.row`
 * five times and `.stack` once, then hand-wrote `display: flex` ten more times
 * with fifteen `align-items` and ten `justify-content` beside it — 48% of its
 * stylesheet was layout the library already ships. Every knob below was
 * undocumented in every generated surface when that run happened.
 *
 * The point the bare list loses is that these are configured by custom
 * properties exactly as components are. `--gap` is a slot, so the universal
 * paint rule applies it, and a layout utility and a component are the same kind
 * of thing. An agent that knows that reaches for `--gap` instead of `gap`.
 *
 * Transcribed from src/layout.css, which has always said all of this. */
export const UTILITIES = {
  intro:
    'Seven utilities, configured by custom properties the same way components ' +
    'are. `--gap` is a slot, so the paint rule applies it. Responsiveness is ' +
    'intrinsic: `switcher` and `sidebar` reflow on the CONTAINER, so there are ' +
    'no breakpoints and no `sm:` / `xl:` variants to learn.',
  list: [
    { name: 'stack', does: 'vertical flow', reads: '--gap (1rem)' },
    { name: 'row', does: 'horizontal, does not wrap', reads: '--gap (1rem)' },
    { name: 'cluster', does: 'horizontal, wraps: tags, icon groups, metadata', reads: '--gap (0.5rem)' },
    { name: 'center', does: 'constrained measure, centred', reads: '--measure (56rem), --pad' },
    { name: 'grid', does: 'as many columns as fit, no breakpoints', reads: '--gap (1rem), --min-item (16rem)' },
    { name: 'switcher', does: 'a row that becomes a stack below a container width', reads: '--gap (1rem), --threshold (24rem)' },
    { name: 'sidebar', does: 'side column plus fluid main, collapses when main gets too narrow', reads: '--gap (2rem), --side (16rem), --min-content (50%)' },
  ],
  alignment:
    'Alignment is attributes, not classes: `data-align="start|center|end|' +
    'baseline|stretch"` and `data-justify="start|center|end|between"`. They are ' +
    'orthogonal, so the utilities take two attributes instead of a class ' +
    'per combination. Reach for these before writing `align-items` by hand.',
  why:
    'Do not hand-write `display: flex` with `align-items` and `gap`. That is ' +
    '`row` or `cluster` plus `data-align`, and the hand-written version leaves ' +
    'the algebra. `--gap` set as plain `gap` is no longer a slot, so nothing ' +
    'can reach it.',
}

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
      'var(--space-4)` is 8px 16px at every size. The type grows, the box does ' +
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
      'Use it sparingly. If everything is raised, nothing is. A ' +
      'recommended pricing tier gets `--lift-2`; the tiers either side get ' +
      '`--lift-1` or nothing.',
  },
  /* This used to be titled "What a slot cannot express" and it produced nothing.
     Filed among the failures, the recipe underneath reads as a workaround for a
     hazard rather than an instruction — a bake-off arm with this exact snippet
     in its prompt wrote zero gradients and shipped a flat hero against a
     reference with an ambient wash. The technique is now stated as a technique.
     The hazard stays in FAILURE_MODES, where a hazard belongs. */
  depth: {
    title: 'Depth: write the slot, then the plain property',
    body:
      'Atmosphere is usually a gradient, and a gradient needs one extra line ' +
      'because `--bg` drives `background-color`. Set the slot, then add what has ' +
      'no slot beside it:\n\n' +
      '    .hero {\n' +
      '      --bg: var(--canvas);\n' +
      '      background-image:\n' +
      '        radial-gradient(60rem 40rem at 20% 0%, var(--shade), transparent 70%),\n' +
      '        radial-gradient(50rem 40rem at 90% 30%, var(--shade), transparent 70%);\n' +
      '    }\n\n' +
      'The slot keeps the element inside the algebra, so tone, variant and theme ' +
      'still reach it. The plain declaration adds the rest. A soft wash ' +
      'behind a large headline is most of the difference between a page that ' +
      'looks composed and one that looks unstyled, and it costs two lines.\n\n' +
      'Two things to get right. Every colour stop is a token: `--shade` and ' +
      '`--shade-strong` are there for this, and a literal in a gradient is still ' +
      'a literal that cannot follow a theme. And `--bg: linear-gradient(…)` ' +
      'paints NOTHING. There is no warning and no fallback; the element silently ' +
      'does not appear. `verify` reports it.\n\n' +
      'The same shape covers anything the fourteen slots miss: set the slot for ' +
      'what is in the algebra, write the plain property for what is not.',
  },
  /* Added because a page built entirely from this contract used `data-tone`
     zero times, `data-size` zero times and `var(--scale)` zero times — three of
     the four headline axes untouched. The design was achromatic, and nothing in
     the contract said the axes were still for it. The axes chapter explains what
     each one does at length; none of it says when to reach for one. */
  axes: {
    title: 'The axes are not only for colourful designs',
    body:
      'A restrained or monochrome page is where authors quietly assume the tone ' +
      'axis is not for them, and then hand-write the variation it would have ' +
      'given free. It is for them. `--tone` can be `--neutral`; a near-black ' +
      'surface, a hairline and its text are `--tone-soft`, `--tone-line` and ' +
      '`--tone-ink` whether or not there is a hue in sight.\n\n' +
      'The test for tone is not "is this colourful" but "does a group of elements ' +
      'vary together". If a section, a card and its button should all shift when ' +
      'one attribute changes, that is `data-tone` on the ancestor and nothing on ' +
      'the children. Tone inherits, which is the whole reason it is an axis and ' +
      'not a class.\n\n' +
      'Size is narrower and it is honest to say so: `--scale` is consumed by ' +
      'components, not by page layout. A hero or a section has nothing to scale ' +
      'against and should not pretend otherwise. Reach for `data-size` on the ' +
      'things that come in sizes, such as buttons, inputs, badges and a compact ' +
      'table, and let the page around them stay on the rem scale.',
  },
  contrast: {
    title: 'Text on a toned surface takes its colour from the tone',
    body:
      'A muted grey that reads well on `--canvas` can be almost invisible on ' +
      '`--tone-soft`, and it lands on exactly the element you most want read: a ' +
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
      'Detail earns its place. A nav, an eyebrow above the headline, an icon tile ' +
      'or a ribbon on the recommended tier is fine on its own; all of them ' +
      'together is noise. Choose two or three.',
  },
}

export const FAILURE_MODES = [
  {
    symptom: 'A gradient set through `--bg` produces no background at all.',
    cause: '`--bg` drives `background-color`, which cannot take a gradient.',
    fix: 'Keep the slot and write the gradient beside it: `--bg: var(--tone); background-image: linear-gradient(…)`.',
    why:
      'The declaration is dropped and the element paints transparent, with no ' +
      'warning anywhere. Nothing about `--bg` says "colour only". It is named for ' +
      'background, and every other slot takes whatever its property takes. This is ' +
      'the general shape for anything the algebra does not model: write the slot, ' +
      'then the plain property. The slot keeps the element inside the algebra; the ' +
      'plain declaration adds what has no slot.',
  },
  {
    symptom: 'Type resizes with `data-size` and the padding around it does not.',
    cause: 'The component\'s `--pad` is written in `rem`, often as `var(--space-*)`, instead of `em`.',
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
      'An unlayered component outranks `largen.modifiers`, so the variant rules ' +
      'lose. Tone and size act through inheriting custom properties rather than by ' +
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
    symptom: 'Every element on the page loses its browser defaults. Lists unindent and headings shrink.',
    cause: 'A slot was given an `initial-value`, or `paint.css` was moved out of its layer.',
    fix: 'Remove the `initial-value`; keep the universal rule inside `@layer largen.paint`.',
    why:
      '`revert-layer` is only meaningful from inside a layer, and only reached when the ' +
      'slot is guaranteed-invalid. Break either condition and the one universal rule ' +
      'stops being inert and starts being destructive.',
  },
  {
    symptom:
      'Your own CSS is inside a cascade layer, and largen still wins. Or your ' +
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
      '           largen.fallback, largen.reset, largen.tokens, largen.paint,\n' +
      '           largen.tone, largen.elements, largen.components, largen.modifiers,\n' +
      '           app-overrides;',
    why:
      'Writing `@layer app.base, largen.components, app.overrides;` reads as ' +
      '"app.base lowest, app.overrides highest" and does not do that. ' +
      '`largen.components` already exists and keeps its position, while the new ' +
      '`app` parent is appended after everything. So `app.base` outranks largen, ' +
      'and `app.overrides` can never reach past it, because both are children of ' +
      'one parent that has one position. Flat names avoid this because `app-base` ' +
      'and `app-overrides` are independent, so they can sit on either side.\n\n' +
      'This is also where a preflight goes when largen runs alongside another ' +
      'framework. Put its base layer in the statement ahead of largen, or it ' +
      'sorts last and flattens everything largen styled. Layer order beats ' +
      'specificity, so no amount of selector weight recovers it.\n\n' +
      'List ALL EIGHT largen sublayers, `largen.fallback` first. A sublayer the ' +
      'statement omits is created when largen loads and appended after the ones ' +
      'listed. For `largen.fallback` that puts its per-element resets above ' +
      '`largen.components` in exactly the engines the fallback exists for ' +
      '(Firefox 113–127, Safari 16.2–16.3), while looking correct in every ' +
      'engine you are likely to test in.\n\n' +
      '`largen verify` cannot catch this. Layer position is a property of the ' +
      'whole document at load time, of which files were seen and in what order, ' +
      'and a linter reading one stylesheet has no way to know. The browser is ' +
      'the only place the answer exists.',
  },
  {
    symptom:
      'A fill is the right colour and the text on it is unreadable. It shows the ' +
      'old tone\'s contrast colour on the new tone\'s background.',
    cause:
      'The component set `--tone` and read `var(--tone-contrast)` without setting ' +
      '`--tone-contrast` alongside it.',
    fix: 'Set the pair together: `--tone: var(--danger); --tone-contrast: var(--danger-on)`.',
    why:
      '`--tone-soft`, `--tone-ink` and `--tone-line` are formulas, and largen ' +
      'recomputes them on every element, so setting `--tone` anywhere is enough ' +
      'for those. `--tone-contrast` is not a formula. It is the paired token ' +
      '(`--danger` pairs with `--danger-on`), and nothing can derive one from the ' +
      'other, so it keeps whatever value was already in scope. The three that ' +
      'follow `--tone` automatically are exactly the three that can be computed ' +
      'from it. `largen verify` and `check_component_css` both flag this.',
  },
  {
    symptom:
      'largen is painting something you want it to leave alone: a third-party ' +
      'widget, a chart, markup another framework owns.',
    cause:
      'The universal paint rule claims a property as soon as any rule sets its ' +
      'slot, and nothing "unsets" a custom property by writing an empty value.',
    fix: 'Set the slot to `initial`: `--bg: initial; --pad: initial`.',
    why:
      'A slot is registered with universal syntax and no `initial-value`, so ' +
      '`initial` returns it to the *guaranteed-invalid* value, the state it has ' +
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
      'guaranteed-invalid. So `var(--fg, revert-layer)` fires and reverts to the ' +
      'user-agent stylesheet, which colours links blue. Measured against a ' +
      'parent at `rgb(3,4,5)`: `inherit` gives `rgb(0,0,238)`, `currentColor` ' +
      'gives `rgb(3,4,5)`.\n\n' +
      'The general lesson is worth more than the recipe. Returning a slot to ' +
      'guaranteed-invalid gets you the user-agent value, never the ambient one. ' +
      'If you want what the surroundings have, name it with `currentColor` ' +
      'rather than trying to get there by removal.',
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
  tagline: 'A property algebra for CSS. Plain CSS, with no build step, no preprocessor and no plugin.',
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
    'above it is already solved. The tones, the variants, the sizes, the states ' +
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
      'state and both themes, none of which it mentions.',
  },
}

export const COMMANDS = [
  { command: 'npx largen verify [css...] [--entry main.css]', does: "check your components against the contract, and resolve the cascade across your files" },
  { command: 'npx largen eval <dir> [dir2] [--entry main.css] [--json]', does: 'score a directory of authored components against the contract, offline and deterministic, with no model' },
  { command: 'npx largen build', does: 'bundle and minify to dist/ for the CDN. Optional, with no dependencies' },
  { command: 'npx largen gen', does: 'regenerate genai artifacts from genai/manifest.json' },
  { command: 'npx largen theme <file.tokens.json>', does: 'validate a DTCG token document against the token vocabulary and emit a theme stylesheet' },
  { command: 'npx largen tokens <file.css>', does: "derive a DTCG token document from a project's stylesheet" },
  { command: 'npx largen manifest <css...>', does: "derive a component manifest from a project's CSS" },
  { command: 'npx largen cascade --property P --at CHAIN <css...>', does: 'which declaration wins for a property on an element, and why, with no browser' },
  { command: 'npx largen slot --slot S --at CHAIN <css...>', does: 'whether the paint rule applies a slot, or it reverts, and to what' },
  { command: 'npx largen probe --page URL --select SEL --prop P', does: 'emit a browser harness for what static checks cannot see' },
]

export const COMMANDS_CAVEAT =
  '`verify` lints the files you point it at, or the component stylesheets it finds ' +
  'under the working directory. A stylesheet is a component file when it declares ' +
  'inside `@layer largen.components`, or sets paint slots without using a largen ' +
  'layer at all, which is a component that forgot the layer. Run inside a clone of ' +
  'largen it also checks the library\'s own invariants.\n\n' +
  '`cascade` and `slot` take the element as an ancestor chain written like a ' +
  'selector: `--at "html body p.prose kbd"`. A chain carries no siblings and no ' +
  'interaction state, so rules turning on `:hover`, `:last-child`, `:nth-*` or a ' +
  'sibling combinator cannot be decided from it. Those are reported as undecidable ' +
  'rather than dropped, because an omission reads as "no rule here" and any one of ' +
  'them could be the rule that actually wins. `probe` settles those.\n\n' +
  '`verify` also resolves the cascade across your files when it can work out the ' +
  'order they load in, inferred from an entry stylesheet or given with ' +
  '`--entry`. That is the check that catches a component whose declaration is ' +
  'correct, whose file is correct, and which still never applies because another ' +
  'layer wins. Without an order it says so rather than guessing.\n\n' +
  'What it still cannot see is rendering. It has passed clean on visibly broken components before; ' +
  'render the result in a browser, in both themes.\n\n' +
  '`build` needs nothing installed. It inlines imports, strips comments and ' +
  'squeezes whitespace, which is all this stylesheet requires. If your own CSS ' +
  'wants a real minifier, bring one and point it at your build; largen does not ' +
  'need one and does not ship one.'

export const GENERATIVE_UI =
  '`genai/manifest.json` is the approved-component allowlist; `schema.json` and ' +
  '`prompt.md` are generated from it by `largen gen`. `genai/validate.js` turns a ' +
  'model-emitted node into an attribute bag and rejects anything else. There is no ' +
  'field for a colour, class or handler, so the safety property is structural rather ' +
  'than defensive. The worst a compromised model can do is pick the wrong approved ' +
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
        'A slot splits deciding a value from applying it. Plain CSS does both in ' +
        'one rule, so every change after that needs another rule that knows the ' +
        'component. Here a component only fills blanks, `--bg: var(--tone-soft)`, ' +
        'and one shared rule applies them. A rule like `[data-variant="outline"] ' +
        '{ --bg: transparent }` knows nothing about any component, so it works on ' +
        'all of them, including ones not written yet. The cost of the system ' +
        'drops from axes times components to axes plus components.\n\n' +
        'Every component is painted from these slots and only these. All are ' +
        "registered `inherits: false` with no `initial-value`, so a component's " +
        'background cannot cascade onto its children, and an unset slot stays ' +
        'guaranteed-invalid. That is what makes `var(--pad, revert-layer)` hand ' +
        'the property back to the UA stylesheet.',
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
          'registered at all. They inherit because inheritance is the default for a ' +
          'custom property. The distinction matters: only a registered property is ' +
          'checked against a syntax, only a registered property can be transitioned, ' +
          'and only a registered universal property with no initial value becomes ' +
          'guaranteed-invalid when unset.',
      },
    },
    /* WHY `*` AND NOT AN ALLOWLIST OF ELEMENTS
     *
     * The recurring instinct is to narrow this to the tags largen actually styles
     * — div, section, a, span. The list is genuinely feasible, which is the
     * strongest argument for it: measured across 21 real pages in this repo,
     * 2,484 element instances resolve to only 45 distinct tags.
     *
     *   ordinary HTML elements                        2,281   92%
     *   head / void / non-visual (meta, link, script)   199    8%
     *   SVG internals                                     4    0%
     *   custom elements                                   0    0%
     *
     * It loses on arithmetic. The only elements an allowlist excludes are the 8%
     * that browsers do not render anyway, while the largest single category —
     * `span`, 751 instances, 30% of everything — is a legitimate component target
     * that has to stay in. There is no large, safely-excludable middle, and the
     * cost is a new silent failure every time a tag is missing from the list.
     *
     * Custom elements are the sharp edge: 27 are supported in the reference CSS
     * and zero appear in any markup on disk, so the affordance is unused today and
     * would break the moment someone wrote <my-card>.
     *
     * The one shape that would overturn this is icon-heavy UI. Four SVG internals
     * across 21 pages is not a sample; an app with inline icons has hundreds of
     * <path> per screen that will never carry a slot, and that IS a real
     * excludable middle. If that appears, re-decide against that page and a
     * benchmark rather than against this comment. The runtime cost has not been
     * measured — the argument above is structural, and the largest page here is
     * 168 elements. */
    paint: {
      rule: readPaintRule(),
      why:
        'One rule reads the slots and applies them to every element. It is safe ' +
        'universally only because an unset slot is guaranteed-invalid, so ' +
        '`var(…, revert-layer)` fires and hands the property straight back to the ' +
        'UA stylesheet. A `<ul>` keeps its indent and an `<h1>` its size. The ' +
        'selector is a bare `*`, not `:where(*)`: the universal ' +
        'selector already contributes no specificity, so there is nothing to wrap. ' +
        'Note `background-color`, not the `background` shorthand, which would also ' +
        'reset `background-image` and the rest of the family.\n\n' +
        'Universal is also what keeps generated CSS uniform. Because every element ' +
        'is paintable the same way, "is this element paintable?" is never a question ' +
        'you have to answer, and a question you do not answer is one you cannot ' +
        'answer differently twice. Narrow the rule and it becomes a real decision, ' +
        'slots here and plain CSS there, made fresh for every component; that choice ' +
        'point is where drift enters. The closed vocabulary depends on it too: CSS ' +
        'has hundreds of properties and this algebra has fourteen slots, and an ' +
        'element outside the rule is an element where the only option left is ' +
        'arbitrary CSS. Uniformity then follows by construction rather than by ' +
        'discipline. Every painted surface goes through the same slots, so tone, ' +
        'variant, size and theme reach all of it. A narrowed rule would sort ' +
        'elements into two tiers and produce pages where some parts follow the theme ' +
        'and some quietly do not. It is also nothing to remember. An allowlist would ' +
        'have to be carried in this contract and consulted correctly every time, ' +
        'while `*` costs no tokens and cannot be misremembered.',
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
        'is the one that is not wrapped, because a bare `*` is already specificity-free. ' +
        '`fallback` sorts below everything and exists only for engines that predate ' +
        '`@property` (Firefox 113–127, Safari 16.2–16.3): behind an engine-sniff ' +
        '`@supports`, it re-declares every slot to `initial` per element so a slot ' +
        'cannot inherit; in a conforming engine it matches nothing and the ' +
        'registrations are authoritative.',
    },
    rules: RULES,
    failureModes: FAILURE_MODES,
    utilities: UTILITIES,
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
  'utilities', 'composition', 'commands', 'generativeUI', 'notes']

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
