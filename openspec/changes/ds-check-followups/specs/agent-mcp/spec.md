# Spec Delta

## ADDED Requirements

### Requirement: Coined-tag role check
The lint surfaces (`check_component_css` and `largen verify`) SHALL report a
finding when authored CSS or a validated spec coins an element name that
implies an interactive or landmark role — a name whose leading token matches a
native interactive or sectioning element, such as `button-*`, `nav-*`,
`dialog-*`, `input-*` or `select-*`. The finding SHALL name the native element
the pattern already has. The finding's severity SHALL be `warning` in the 0.6.x
release line and `error` from 0.7.0, so that no 0.6.x patch turns a previously
clean `verify` run into a failing one.

#### Scenario: A component coins a role-implying tag (0.6.x)
- **WHEN** a stylesheet authored against a 0.6.x release declares a component
  selector such as `button-primary` as an element name
- **THEN** the lint SHALL report a warning naming `<button>` as the element the
  pattern already has
- **AND** the overall verdict SHALL remain clean if no errors exist

#### Scenario: A component coins a role-implying tag (0.7.0)
- **WHEN** the same stylesheet is linted against a 0.7.0 or later release
- **THEN** the same finding SHALL be reported as an error and the verdict SHALL
  be failing

#### Scenario: A component coins a role-less tag
- **WHEN** a stylesheet declares a component such as `notification` or `card`
  as an element name
- **THEN** no coined-tag finding SHALL be reported, because the pattern has no
  interactive or landmark role to lose

### Requirement: Dark-mode rule check
The lint surfaces SHALL report an error when a component stylesheet contains a
dark-mode rule — a `prefers-color-scheme` media query, or a rule scoped to a
theme selector such as `[data-theme="dark"]` — regardless of whether the rule's
values are literals or tokens. The contract has always forbidden the rule
itself, not merely literal colours inside it: a component that adapts to dark
mode by hand is a defect in the algebra being patched over. This check enforces
an existing SHALL NOT, so it SHALL be an error from its first release.

#### Scenario: A dark rule written with tokens
- **WHEN** a component stylesheet contains
  `@media (prefers-color-scheme: dark) { .plan-capacity { --bg: var(--surface); } }`
- **THEN** the lint SHALL report an error identifying the dark-mode rule
- **AND** the finding SHALL NOT depend on any colour literal being present

#### Scenario: A theme-selector-scoped component rule
- **WHEN** a component stylesheet scopes a rule to `[data-theme="dark"]`
- **THEN** the lint SHALL report the same error

#### Scenario: A theme stylesheet sets tokens under a theme selector
- **WHEN** a stylesheet classified as a theme sets tokens under a theme
  selector
- **THEN** no finding SHALL be reported, because that is what a theme is

### Requirement: Hand-written size variant check
The lint surfaces SHALL report an error when a component declares its own size
variant — a modifier selector whose name ends in a size-axis value
(`xs`, `sm`, `md`, `lg`, `xl`), or a rule scoped to a `data-size` attribute
selector, that re-sets scale slots such as `--pad`, `--font-size` or `--gap` —
regardless of whether the values are literals or tokens. Sizes come from the
axis; a hand-written variant duplicates it for one component and silently stops
tracking it. This check enforces an existing SHALL NOT, so it SHALL be an error
from its first release.

#### Scenario: A size-suffixed modifier written with tokens
- **WHEN** a component stylesheet contains
  `.plan-capacity--lg { --pad: var(--pad-5); --font-size: var(--text-lg); }`
- **THEN** the lint SHALL report an error naming the size axis as the
  mechanism the variant duplicates

#### Scenario: A component scopes rules to data-size
- **WHEN** a component stylesheet declares a rule under `[data-size="lg"]`
  that re-sets scale slots
- **THEN** the lint SHALL report the same error

#### Scenario: A modifier that is not a size
- **WHEN** a component declares a modifier such as `.plan-capacity--empty`
  that sets non-scale slots
- **THEN** no size-variant finding SHALL be reported

### Requirement: Out-of-schema arguments fail loudly
A tool call whose arguments do not conform to the tool's declared input schema
— a wrong-typed value, a value outside a declared enum, or a missing required
parameter — SHALL produce an error result identifying the offending argument.
It SHALL NOT be answered with a degraded or empty result that is
indistinguishable from a genuine negative answer.

#### Scenario: An enum is violated
- **WHEN** a caller passes `theme: "sepia"` where the schema declares
  `enum: ["light", "dark"]`
- **THEN** the call SHALL return an error result naming `theme` and the
  permitted values
- **AND** SHALL NOT render under a default theme as though the argument had
  been accepted

#### Scenario: A number arrives as a string
- **WHEN** a caller passes a string where the schema declares a number
- **THEN** the call SHALL return an error result naming the argument and the
  expected type
- **AND** SHALL NOT return an empty result set, because an empty answer to a
  malformed question reads as a true negative
