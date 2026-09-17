## ADDED Requirements

### Requirement: Registration fallback
The library SHALL ship a fallback layer, sorted below every other library
layer, that reproduces the slot registrations in engines that lack
`@property`. Behind a condition matching only those engines, it SHALL
re-declare every non-inheriting slot to `initial` on every element and
pseudo-element, and SHALL seed each inheriting registered property's
initial-value at the root rather than resetting it per element.

The fallback SHALL mirror the registrations exactly, and verification SHALL
fail on any drift between the two: a slot registered but not reset, a reset
not backed by a registration, or an inheriting property reset per element.

#### Scenario: A slot is unset in an engine without @property
- **WHEN** an element sets no value for a slot
- **THEN** that slot SHALL resolve as guaranteed-invalid, so the paint rule's
  fallback fires and the UA value survives

#### Scenario: A slot is set on a parent in an engine without @property
- **WHEN** an element sets `--bg` and contains a child that does not
- **THEN** the child SHALL NOT inherit the parent's value

#### Scenario: A component sets a slot in an engine without @property
- **WHEN** a component declares a slot from a later layer
- **THEN** the component's value SHALL win over the fallback's reset

#### Scenario: A slot is added without updating the fallback
- **WHEN** a new `@property` registration is added and the fallback is not
- **THEN** verification SHALL fail and name the missing slot

## MODIFIED Requirements

### Requirement: Cascade layer order
The library SHALL declare its layers in the order `fallback`, `reset`,
`tokens`, `paint`, `tone`, `elements`, `components`, `modifiers`, and SHALL
contain no `!important`.

#### Scenario: A component sets a default fill and a variant is requested
- **WHEN** a component sets `--bg` and the element also carries `data-variant`
- **THEN** the variant SHALL win

#### Scenario: A bare element default competes with a component class
- **WHEN** a `<button>` carries a component class that sets `--bg`
- **THEN** the component class SHALL win over the bare-element default

#### Scenario: Consumer CSS overrides the library
- **WHEN** unlayered author CSS sets a property the library also sets
- **THEN** the author CSS SHALL win without requiring `!important`

#### Scenario: The fallback competes with anything at all
- **WHEN** any other library layer or author CSS declares a slot the fallback
  resets
- **THEN** the other declaration SHALL win, because the fallback sorts below
  everything
