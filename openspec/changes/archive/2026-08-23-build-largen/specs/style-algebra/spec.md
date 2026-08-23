## ADDED Requirements

### Requirement: Slot registration
The library SHALL register every paint slot with `@property` using universal
syntax (`syntax: "*"`), `inherits: false`, and no `initial-value` descriptor.

#### Scenario: A slot is unset
- **WHEN** an element does not set a given slot
- **THEN** that slot SHALL hold the guaranteed-invalid value
- **AND** any `var()` referencing it SHALL resolve to its fallback

#### Scenario: A slot is set on a parent
- **WHEN** an element sets `--bg` and contains a child that does not
- **THEN** the child SHALL NOT receive the parent's `--bg`

#### Scenario: A slot is given an initial-value
- **WHEN** a slot declares `initial-value`
- **THEN** verification SHALL fail, because the slot can never be unset and the
  universal paint rule would reset that property on every element

### Requirement: Universal paint rule
The library SHALL paint every element from the slots via a single rule, inside a
cascade layer, with every declaration falling back to `revert-layer`.

#### Scenario: An element sets no slots
- **WHEN** an element on the page sets no slots
- **THEN** every painted property SHALL revert to its user-agent value
- **AND** a `<ul>` SHALL keep its indent, an `<h1>` its font size, a `<button>`
  its padding

#### Scenario: An element sets a slot
- **WHEN** an element sets `--pad: 30px`
- **THEN** that element SHALL receive 30px padding

#### Scenario: The paint rule is not layered
- **WHEN** the paint rule is not inside a cascade layer
- **THEN** verification SHALL fail, because `revert-layer` is meaningless
  outside a layer

### Requirement: Tone axis
`data-tone` SHALL set an inheriting `--tone` and its contrast pair, and the
derived values `--tone-soft`, `--tone-ink` and `--tone-line` SHALL be computed
from `--tone` by a formula declared exactly once.

#### Scenario: Tone is set on an ancestor
- **WHEN** a container carries `data-tone="danger"` and contains components with
  no tone of their own
- **THEN** every such descendant component SHALL render in the danger tone

#### Scenario: A nested container sets a different tone
- **WHEN** a `data-tone="success"` container sits inside a `data-tone="danger"` one
- **THEN** components inside the inner container SHALL render in the success tone
- **AND** components outside it SHALL remain in the danger tone

### Requirement: Variant axis
`data-variant` SHALL provide `solid`, `soft`, `outline` and `ghost`, each derived
from the current tone rather than from an independent colour, and SHALL apply
only to the element carrying the attribute.

#### Scenario: A variant is requested
- **WHEN** an element carries `data-variant="outline"`
- **THEN** its background SHALL be transparent and its border SHALL take the tone

#### Scenario: A variant is set on a container
- **WHEN** a container carries `data-variant="solid"`
- **THEN** descendants SHALL NOT inherit the variant

### Requirement: Size axis
`data-size` SHALL set an inheriting `--scale` number, and no component SHALL
declare a size variant.

#### Scenario: Size is set on a container
- **WHEN** a container carries `data-size="sm"` and contains components with no
  size of their own
- **THEN** those components SHALL render at the reduced scale

### Requirement: State axis
State SHALL be taken from DOM pseudo-classes rather than from an attribute.

#### Scenario: A field is read-only
- **WHEN** a text input or textarea is read-only and not focused
- **THEN** it SHALL take the surface background

#### Scenario: A checkbox is rendered
- **WHEN** a checkbox, radio, range or file input is rendered
- **THEN** it SHALL NOT be treated as read-only, despite matching `:read-only`
  per specification

### Requirement: Cascade layer order
The library SHALL declare its layers in the order `reset`, `tokens`, `paint`,
`tone`, `elements`, `components`, `modifiers`, and SHALL contain no
`!important`.

#### Scenario: A component sets a default fill and a variant is requested
- **WHEN** a component sets `--bg` and the element also carries `data-variant`
- **THEN** the variant SHALL win

#### Scenario: A bare element default competes with a component class
- **WHEN** a `<button>` carries a component class that sets `--bg`
- **THEN** the component class SHALL win over the bare-element default

#### Scenario: Consumer CSS overrides the library
- **WHEN** unlayered author CSS sets a property the library also sets
- **THEN** the author CSS SHALL win without requiring `!important`
