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
      'wrapper element it passed through.',
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
      'component is the cost the size axis exists to remove.',
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
      'largen needs no build step.',
  },
]

/* --- How it fails --------------------------------------------------------- */

export const FAILURE_MODES = [
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
  { command: 'npx largen verify [css...]', does: "check your components against the contract above" },
  { command: 'npx largen build', does: 'bundle + minify to dist/ — optional, for CDN' },
  { command: 'npx largen gen', does: 'regenerate genai artifacts from genai/manifest.json' },
  { command: 'npx largen manifest <css...>', does: "derive a component manifest from a project's CSS" },
]

export const COMMANDS_CAVEAT =
  '`verify` lints the files you point it at, or the component stylesheets it finds ' +
  'under the working directory — a stylesheet is a component file when it declares ' +
  'inside `@layer largen.components`. Run inside a clone of largen it additionally ' +
  'checks the library\'s own invariants.\n\n' +
  'All of it is static. It has passed clean on visibly broken components before; ' +
  'render the result in a browser, in both themes.'

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
      inheriting: [...slots.inheriting, '--tone', ...readToneDerivations()],
      why:
        'Every component is painted from these and only these. All are registered ' +
        "`inherits: false` with no `initial-value`, so a component's background " +
        'cannot cascade onto its children and an unset slot stays guaranteed-invalid. ' +
        'The inheriting list is the deliberate exception: `--tone` and its derivations ' +
        're-tone a whole subtree, and `--scale` resizes one.',
    },
    axes,
    layers: {
      order: readLayerOrder(),
      why:
        '`elements` sits before `components` so a component class beats a bare-element ' +
        "default; `modifiers` sits last so an explicit variant beats a component's own " +
        'default fill. Everything is layered and every selector is `:where()`-wrapped, ' +
        'so consumer CSS always wins without `!important`.',
    },
    rules: RULES,
    failureModes: FAILURE_MODES,
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

export const SECTIONS = ['overview', 'slots', 'axes', 'layers', 'rules', 'failureModes',
  'commands', 'generativeUI', 'notes']

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
