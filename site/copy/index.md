# Homepage prose. Structure lives in skill/scripts/pages.mjs; each `## key`
# below is one fragment it renders. {{name}} values are derived from the real
# artifacts at generation time and must not be written as literals here.

## hero-lede
{{slots}} custom-property slots, four axes, and one universal paint rule. The
components are yours to write. Plain CSS, with no build step, no preprocessor
and no plugin.

## complete-component-note
It gets {{tones}} tones, {{variants}} variants, {{sizes}} sizes, every state
and both themes, and it mentions none of them. Everything above the component
row is already solved, so the component is the only thing left to write.

## slots-intro
Plain CSS decides a colour and applies it in the same rule, so every change
after that needs another rule that knows the component. With {{tones}} tones,
{{variants}} variants and {{sizes}} sizes, that is {{combos}} combinations per
component before hover and dark mode. A slot splits deciding from applying.

## slots-outro
The outline rule knows nothing about chips, so it works on every component,
including ones not written yet. The cost of the system drops from axes times
components to axes plus components.

## four-features
`@property` registers each slot as non-inheriting, so a slot stops at its
element. A card's background stays on the card.

`revert-layer` is the fallback when a slot is unset, so an empty blank leaves
the element as the browser drew it.

`@layer` keeps every largen rule in a named layer, so your page CSS always
beats largen without `!important`.

`color-mix()` derives the soft, ink and line shades from the one tone in
scope, so dark mode needs no per-component rules.

## not-a-catalog
Most CSS libraries ship components and ask you to configure them. largen ships
the algebra underneath components and expects you to write your own, named in
your application's own language: `.entry-card`, not `.card-lg-bordered`.

Each tier is paired with a check. A component that sets a colour literal,
reaches past the tone axis, sets an unregistered slot or forgets its layer
fails `largen verify` and `check_component_css`, and a spec that names an
unapproved component fails `validate_spec`. With one legal way to colour a
thing, anything hand-set is easy for a machine to spot.

That premise shapes the [MCP server](/docs/mcp.html) too. It cannot know your
components, so every tool takes an optional manifest of them and answers in
your vocabulary rather than largen's.

## card-contract
{{slots}} slots, the layer rule, the paint rule. What the library guarantees.

## card-axes
tone, variant, size, state, and why only two of them inherit.

## card-authoring
{{rules}} rules for writing a component, and the {{modes}} ways it goes wrong.

## card-components
{{components}} optional components. Copy them or ignore them.

## card-mcp
{{tools}} tools for agents. No API key, no generate_ui.

## card-play
Render a spec. Share it in a URL with no server involved.

## use-note
For agents: [/llms-compact.txt](/llms-compact.txt) carries the whole contract
inline, about {{compactTokens}} tokens.

## evidence-intro
Two pages that run in your browser and report what they find. Neither is a
gallery. They exist because the claims below them are the ones no static check
can settle.

## card-conformance
The mechanism everything hangs on, `revert-layer` against a guaranteed-invalid
slot, and the @property fallback that preserves it in Firefox 113–127 and
Safari 16.2–16.3. {{conformance}} checks. Open it in Safari, Firefox and
Chrome; nothing static can answer this.

## card-tests
UA defaults survive the universal paint rule, tone inherits, slots do not leak
to children, and modifiers outrank components.

## releases-note
Every entry in the log is checked against the bytes that version actually
shipped. [The full log](https://github.com/vikramrojo/largen/blob/main/RELEASES.md)
· [npm](https://www.npmjs.com/package/largen)
