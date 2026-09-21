# Spec Delta

## Purpose

A W3C Design Tokens Community Group (DTCG) JSON form of largen's token
vocabulary, so a theme can travel between design tools and largen in both
directions: the library exports its defaults and shipped themes, a consumer
imports a token document as a validated theme stylesheet, and a guard keeps the
JSON equal to the CSS that remains the source of truth.

## ADDED Requirements

### Requirement: Every vocabulary token has a DTCG type and shape
Every token a theme may set SHALL map to a DTCG token with a declared `$type`
from the set `color`, `dimension`, `duration`, `fontFamily`, `fontWeight`,
`number` and `shadow`. Tone pairs SHALL be groups whose `$root` is the tone and
whose `on` member is its contrast colour, so that the pair constraint is
structural rather than a naming convention. The default tone
(`--tone`/`--tone-contrast`) SHALL be an alias of the neutral pair. Shadow
tokens SHALL reference the shade tokens rather than restate their colour.
Nothing in the vocabulary SHALL require an escape hatch.

#### Scenario: A material colour is exported
- **WHEN** `--ink: #16181c` is exported
- **THEN** the token SHALL be `$type: color` with an sRGB `components` triple
  and the `hex` string, and no `alpha`

#### Scenario: A translucent colour is exported
- **WHEN** `--shade: rgba(0, 0, 0, 0.08)` is exported
- **THEN** the token SHALL carry `alpha: 0.08` and SHALL NOT lose the opacity

#### Scenario: A tone pair is exported
- **WHEN** `--primary` and `--primary-on` are exported
- **THEN** they SHALL appear as `tone.primary.$root` and `tone.primary.on`
  under a group typed `color`

#### Scenario: The default tone is exported
- **WHEN** `--tone: var(--neutral)` and `--tone-contrast: var(--neutral-on)`
  are exported
- **THEN** they SHALL be references to `{tone.neutral.$root}` and
  `{tone.neutral.on}`, not literals

#### Scenario: A shadow is exported
- **WHEN** `--lift-1: 0 1px 2px var(--shade)` is exported
- **THEN** it SHALL be a `shadow` whose `color` is the reference `{shade}` and
  whose offsets, blur and spread are dimensions

#### Scenario: A neutral tone that merely matches ink
- **WHEN** `--neutral` has the same value as `--ink` in one theme but not in
  another
- **THEN** it SHALL be exported as a literal, because the CSS declares no
  dependency between them

#### Scenario: A value with a unit is exported
- **WHEN** `--space-4: 1rem`, `--hairline: 1px`, or `--speed: 0.12s` is exported
- **THEN** the token SHALL carry the value and the unit as authored, and SHALL
  NOT convert between units

#### Scenario: A font stack is exported
- **WHEN** `--font-ui` is exported
- **THEN** it SHALL be a `fontFamily` array, most-preferred first, with quoted
  family names unquoted

### Requirement: The defaults document is complete and a theme document is partial
The exported defaults document SHALL contain every token in the vocabulary. A
theme document MAY set any subset of the vocabulary and SHALL be validated as a
subset: a theme that sets a tone SHALL set both halves, and a theme SHALL NOT
need to restate tokens it does not change. A document SHALL identify itself
through `$extensions["dev.largen"]`: the library version and build it was
generated from, the DTCG draft it targets, the theme name and colour scheme.

#### Scenario: The defaults are exported
- **WHEN** the defaults document is generated
- **THEN** every vocabulary token SHALL be present with `$type` and `$value`

#### Scenario: The dark theme is exported
- **WHEN** `themes/dark.css` is exported
- **THEN** the document SHALL contain exactly the tokens the theme sets, its
  theme name SHALL be `dark`, and its colour scheme SHALL be `dark`

#### Scenario: A theme sets a tone without its contrast
- **WHEN** a document sets `tone.primary.$root` and not `tone.primary.on`
- **THEN** import SHALL fail and name the missing half, because a solid variant
  is impossible without the pair

### Requirement: The build exports the token documents
The build command SHALL emit a DTCG document for the defaults and one for each
shipped theme beside the stylesheets it already emits, SHALL record each with a
digest in the build manifest, and SHALL ship them in the package. The
documents SHALL be derived from the CSS at build time and never hand-edited.

#### Scenario: The build runs
- **WHEN** `largen build` completes
- **THEN** `dist/largen.tokens.json` and `dist/theme-dark.tokens.json` SHALL
  exist and `dist/build.json` SHALL list each with `sha256` and `integrity`

#### Scenario: A token document is hand-edited
- **WHEN** a token document differs from what the CSS would generate
- **THEN** the drift guard SHALL fail and name the differing token

### Requirement: A stylesheet exports as a token document
The tokens command SHALL take a path to any stylesheet and emit the DTCG
document for the custom properties it declares — to a file with `--out`, to
stdout otherwise — with every human-readable line on stderr, so the document
can be redirected even when the read has something to report.

It SHALL find the rule that declares the tokens rather than assume the sheet
opens with it: a top-level at-rule SHALL be skipped whole rather than descended
into, a rule declaring no custom property SHALL be passed over, and a
`color-scheme` on a rule so skipped SHALL be carried forward. It SHALL report
what it could not read — a sheet declaring no custom property anywhere, a
second rule that declares some and was not read, a declaring rule inside a
conditional at-rule read as though unconditional — rather than return a short
document with no comment. A sheet yielding no token SHALL write nothing and
SHALL exit non-zero, an empty document being of no use to anyone.

#### Scenario: The sheet opens with something other than its tokens
- **WHEN** a stylesheet begins with `@font-face`, or with an `html { … }` reset,
  and declares its tokens in a `:root` after it
- **THEN** the export SHALL read `:root` and every token in it, not the first
  rule in the file

#### Scenario: A sheet declares tokens in more than one rule
- **WHEN** a second top-level rule also declares custom properties
- **THEN** the export SHALL read the first and SHALL warn, naming the rule it
  did not read, so the short document is accounted for

#### Scenario: A sheet declares no tokens at all
- **WHEN** no rule in the stylesheet declares a custom property
- **THEN** the export SHALL warn, write nothing, and exit non-zero

#### Scenario: A theme stylesheet is exported
- **WHEN** the declaring rule's selector is `[data-theme="brand"]`
- **THEN** the document's theme name SHALL be `brand` unless `--theme`
  overrides it, and the sheet's colour scheme SHALL be the document's

### Requirement: A token document imports as a theme stylesheet
The theme command SHALL accept a DTCG document and emit a stylesheet that sets
tokens only, inside `@layer largen.tokens` by default, under the selector named
by the document's theme name or the `--theme` option, with `color-scheme`
emitted from the document's colour scheme. Values SHALL be emitted in the form
a person writes: hex for opaque colours, `rgba()` for translucent ones, a bare
`0` for a zero length, and units as given. The generated header SHALL state the
command that produced it, the library version, the DTCG draft, and whether the
output is layered.

#### Scenario: A dark document is imported
- **WHEN** `largen theme dark.tokens.json` runs
- **THEN** the output SHALL be `@layer largen.tokens { [data-theme="dark"] { … } }`
  containing `color-scheme: dark` and one declaration per token in the document

#### Scenario: The OS preference is requested
- **WHEN** `--scheme-media` is passed
- **THEN** the output SHALL additionally contain the same declarations under
  `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }`,
  generated from the one document rather than written twice

#### Scenario: An unlayered theme is requested
- **WHEN** `--unlayered` is passed
- **THEN** the output SHALL have no `@layer` wrapper and the header SHALL say
  so, since an unlayered theme outranks every layer

#### Scenario: A zero length is imported
- **WHEN** a dimension is `{ "value": 0, "unit": "rem" }`
- **THEN** the emitted declaration SHALL be `0`

#### Scenario: A colour is given in either form
- **WHEN** a colour token carries `hex` only, or `components` only
- **THEN** import SHALL accept it; when both are present and disagree, import
  SHALL fail and name the token

#### Scenario: The round trip is exact
- **WHEN** the defaults document is imported
- **THEN** the emitted declarations SHALL equal those in `src/tokens.css`,
  name for name and value for value

#### Scenario: A hex is authored in upper case
- **WHEN** `--ink: #16181C` is exported and that document imported again
- **THEN** the emitted declaration SHALL be `#16181C`, because the letter case
  a person authored is theirs and neither direction SHALL normalise it
- **AND** only a hex largen constructs from `components` alone SHALL be lower
  case, there being no authored case to keep

### Requirement: Import validates before it emits
The theme command SHALL validate the document and SHALL emit nothing on an
error. Errors: a reference that resolves in a cycle; a token with neither
`$value` nor a raw-CSS extension; a `$value` that does not parse for its
`$type`; a name containing `{`, `}` or `.` or starting with `$`; a `space.*`
dimension whose unit is not `rem`; a tone with one half; and an extra token
whose flattened name collides with a registered slot or a derived tone name.
Warnings: a vocabulary token whose `$type` differs from the vocabulary's; a
reference to a name the document does not define; and a reference whose
target's type differs from the referring token's own. A cycle SHALL stay an
error and an absent target SHALL be a warning, because a cycle is provable from
the document alone and resolves in no browser, while the rest of the cascade
lies outside the document and largen cannot see it. Under `--strict`, warnings
SHALL be errors. Every message SHALL name the token path.

#### Scenario: A space token is not in rem
- **WHEN** `space.4` is `{ "value": 16, "unit": "px" }`
- **THEN** import SHALL fail and say that space stays in rem so a section gap
  does not grow under the size axis

#### Scenario: A reference cycle
- **WHEN** `a` references `{b}` and `b` references `{a}`
- **THEN** import SHALL fail and name the cycle

#### Scenario: A reference to a name nothing defines
- **WHEN** a token's `$value` is `{brand.paper}` and no token in the document
  sits at that path
- **THEN** import SHALL warn, name the property it is about to emit, and emit
  `var(--brand-paper)`
- **AND** under `--strict` it SHALL fail instead

#### Scenario: An alias points at a different type
- **WHEN** a token declared `number` references a token whose type is
  `dimension`
- **THEN** import SHALL warn, name the token and both types, and still emit the
  reference
- **AND** when either type is unknown — an absent target has none — it SHALL
  say nothing, rather than guess

#### Scenario: A consumer retypes a vocabulary token
- **WHEN** `line-height-base` is given as a `dimension` where the vocabulary
  says `number`
- **THEN** import SHALL warn, name the token and both types, and emit the value
- **AND** under `--strict` it SHALL fail instead

#### Scenario: An extra shadows a slot
- **WHEN** an extra token would flatten to `--radius` or `--pad`
- **THEN** import SHALL fail, because the universal paint rule would read it

#### Scenario: A typo in a value
- **WHEN** a colour `$value` is a string that is not a colour
- **THEN** import SHALL fail rather than pass the string through as CSS

### Requirement: Project extras travel with the theme
A document MAY carry tokens outside the vocabulary. Each SHALL pass the same
DTCG checks and SHALL be emitted as a custom property named by joining its path
with `-`. A token whose CSS value has no DTCG type MAY carry it verbatim in
`$extensions["dev.largen"].css`; the theme command SHALL emit that string and
other tools SHALL see the `$value` fallback if one is given.

A reference SHALL be emitted as `var()` on its target's flattened name, whether
the target is a vocabulary token, a project extra, or a name this document does
not define, and SHALL NOT be replaced by the target's value. The indirection is
what the document declared: a theme that moves one token moves everything
pointing at it, and a light and dark pair MAY therefore split its extras across
two documents, each referring to what the other defines.

#### Scenario: A project extra is imported
- **WHEN** a document contains `text.display` with a `dimension` value
- **THEN** the output SHALL contain `--text-display` with that value, and the
  vocabulary check SHALL ignore it

#### Scenario: A project extra is referenced
- **WHEN** a token's `$value` references `{brand.paper}` and the document
  defines it
- **THEN** the output SHALL contain `var(--brand-paper)`, not the value that
  token holds

#### Scenario: A reference points at a slot or a derived name
- **WHEN** a reference flattens to a registered slot like `--pad`, or to a name
  the algebra derives
- **THEN** import SHALL warn and SHALL still emit the reference, because those
  properties exist and the reference merely means something other than
  intended; it is declaring at such a name that is the error

#### Scenario: A fluid or mixed value
- **WHEN** a token carries `$extensions["dev.largen"].css: "clamp(2.5rem, 8vw, 5rem)"`
- **THEN** the output SHALL contain the clamp expression verbatim, whether or
  not a `$value` fallback is present

### Requirement: The JSON cannot drift from the CSS
The CSS SHALL remain the source of truth. In the library repository, the verify
command SHALL assert that the vocabulary covers `src/tokens.css` exactly in
both directions, that exporting the CSS and importing the result reproduces
the same declarations, and, when the built documents are present, that they
equal a fresh export. When they are absent it SHALL say the check did not run.

#### Scenario: A token is added to the CSS without a vocabulary entry
- **WHEN** `src/tokens.css` gains a token the vocabulary does not name
- **THEN** verify SHALL fail and name the token

#### Scenario: A vocabulary entry has no token in the CSS
- **WHEN** the vocabulary names a token `src/tokens.css` does not set
- **THEN** verify SHALL fail and name the entry

#### Scenario: The built documents are stale
- **WHEN** `dist/largen.tokens.json` exists and differs from a fresh export
- **THEN** verify SHALL fail and name the first differing token

#### Scenario: The built documents are absent
- **WHEN** `dist/` has not been built
- **THEN** verify SHALL report the staleness check as not run, and SHALL still
  run the coverage and round-trip checks

### Requirement: The document shape is a promised surface
The exported shape is something downstream pipelines depend on. A change to it
SHALL ride a minor release, SHALL be recorded in the release log, and the DTCG
draft snapshot the shape targets SHALL be named in every document so a later
migration knows what it is reading.

#### Scenario: A consumer pins the format
- **WHEN** a Style Dictionary or Figma pipeline consumes the export
- **THEN** a patch release SHALL NOT change the shape of the emitted JSON

#### Scenario: The DTCG draft moves
- **WHEN** the targeted draft changes a value shape
- **THEN** the library SHALL keep emitting the pinned snapshot until a minor
  release changes it, and import SHALL keep accepting the pinned snapshot
