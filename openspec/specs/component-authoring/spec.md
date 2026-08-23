# component-authoring Specification

## Purpose
TBD - created by archiving change build-largen. Update Purpose after archive.
## Requirements
### Requirement: A component is a bundle of slot values
A component SHALL be defined by setting paint slots plus whatever structural
declarations its shape genuinely needs. It SHALL NOT set colour properties
directly.

#### Scenario: A component needs a tinted background
- **WHEN** a component requires a subtle tinted background
- **THEN** it SHALL set `--bg: var(--tone-soft)` rather than `background-color`

### Requirement: Components reach only as far as the tone
A component SHALL reference `--tone`, `--tone-soft`, `--tone-ink`,
`--tone-line` or `--tone-contrast`, and SHALL NOT reference a raw semantic token
such as `--danger`, nor contain a colour literal.

#### Scenario: A component references a semantic token directly
- **WHEN** a component sets `--bg: var(--danger)`
- **THEN** verification SHALL fail, because the component no longer responds to
  the inherited tone

#### Scenario: A component contains a hex colour
- **WHEN** a component contains `#fee` or an `rgb()` value
- **THEN** verification SHALL fail

### Requirement: Components are declared in the components layer
A component SHALL be declared inside `@layer largen.components`.

#### Scenario: A component is declared unlayered
- **WHEN** a component rule is written outside any cascade layer
- **THEN** it SHALL outrank `largen.modifiers`
- **AND** `data-variant` SHALL silently stop affecting that component while
  `data-tone` and `data-size` continue to work
- **AND** verification SHALL fail

#### Scenario: A project overrides a library component
- **WHEN** a project writes an unlayered rule adjusting a component
- **THEN** that override SHALL win without `!important`

### Requirement: Components are addressable as class or custom element
Every component SHALL be usable as a class and as a custom element, with no
registration step.

#### Scenario: A component is used as a custom element
- **WHEN** markup contains `<entry-card>`
- **THEN** it SHALL render identically to `<div class="entry-card">`

#### Scenario: Semantics matter
- **WHEN** an element needs link, navigation, list or disclosure semantics
- **THEN** the real HTML element SHALL be used with a component class, rather
  than a custom element

### Requirement: Components never encode theme or size
A component SHALL NOT contain a dark-mode rule, and SHALL NOT declare a size
variant.

#### Scenario: A component must adapt to dark mode
- **WHEN** the theme changes
- **THEN** the component SHALL follow via token resolution alone

#### Scenario: A component must scale
- **WHEN** a component sets a type size
- **THEN** it SHALL multiply by `var(--scale)` and express related spacing in
  `em`

### Requirement: Prefer platform elements
Where HTML provides an element for a pattern, the library SHALL style that
element rather than define a replacement component.

#### Scenario: A modal is required
- **WHEN** a project needs a modal dialog
- **THEN** `<dialog>` SHALL be used and is already themed

#### Scenario: A disclosure is required
- **WHEN** a project needs a collapsible section
- **THEN** `<details>` SHALL be used and is already themed

