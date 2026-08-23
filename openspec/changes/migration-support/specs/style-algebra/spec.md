## MODIFIED Requirements

### Requirement: Slot registration
The library SHALL register every paint slot with `@property` using universal
syntax (`syntax: "*"`), `inherits: false`, and no `initial-value` descriptor.

The registered slots SHALL cover typography completely: size, weight, leading and
tracking, so a component that changes one has somewhere in the algebra to express
the others.

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

#### Scenario: A component changes its font size
- **WHEN** a component sets the font-size slot
- **THEN** it SHALL be able to set leading and tracking through slots as well
- **AND** SHALL NOT have to fall back to plain declarations for them

#### Scenario: A slot drives an inherited CSS property
- **WHEN** a slot drives a property that inherits, such as line-height
- **THEN** leaving it unset SHALL preserve the inherited value rather than
  replacing it with the property's initial value

### Requirement: Universal paint rule
One rule SHALL paint every element from the registered slots, each declaration
falling back to `revert-layer`, and SHALL be declared inside a cascade layer.

#### Scenario: An element sets no slots
- **WHEN** an element matches the universal rule and sets no slot
- **THEN** every declaration SHALL revert
- **AND** the element SHALL keep its user-agent defaults

#### Scenario: The rule is moved outside a layer
- **WHEN** the paint rule is declared unlayered
- **THEN** `revert-layer` SHALL no longer be meaningful and every element SHALL
  lose its user-agent defaults

#### Scenario: A slot is added to the library
- **WHEN** a slot is added
- **THEN** the paint rule SHALL consult it
- **AND** documentation stating how many slots exist SHALL derive that count from
  the registrations rather than restating it
