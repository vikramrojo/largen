## ADDED Requirements

### Requirement: A file layered under its own name is not a mislayered component
The contract SHALL distinguish a component that omitted its cascade layer from a
stylesheet that deliberately declares in a layer of its own.

#### Scenario: A framework default sets a paint slot in its own layer
- **WHEN** a stylesheet sets registered slots inside a cascade layer that is not
  `largen.components`
- **THEN** it SHALL be treated as framework, library or system CSS
- **AND** SHALL NOT be reported as a component that forgot its layer, since it did
  not forget one

#### Scenario: A component sets slots outside any layer
- **WHEN** a stylesheet sets registered slots and opens no cascade layer at all
- **THEN** it SHALL be reported, because unlayered CSS outranks `largen.modifiers`
  and `data-variant` silently stops applying

#### Scenario: The layer a component chose turns out to lose
- **WHEN** a component is layered, but its declaration does not win
- **THEN** that SHALL be reported by resolving the cascade rather than by inferring
  it from the layer's name
