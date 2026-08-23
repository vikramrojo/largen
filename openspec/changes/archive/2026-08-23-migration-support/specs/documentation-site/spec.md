## ADDED Requirements

### Requirement: The migration guide maps utilities, not components
The migration guide SHALL provide a lookup from common utility classes to their
largen equivalents, bounded to those where the translation is mechanical.

#### Scenario: A migrator converts spacing, layout or type utilities
- **WHEN** a utility has a direct equivalent, such as a padding or gap utility
- **THEN** the guide SHALL give it
- **AND** the translation SHALL be stated as an equivalence rather than as advice

#### Scenario: A migrator looks for a component mapping
- **WHEN** a migrator looks for a component or variant-matrix mapping
- **THEN** the guide SHALL NOT provide one
- **AND** SHALL say why in the lookup itself, so its absence reads as a position
  rather than an omission

#### Scenario: The table would grow beyond the mechanical
- **WHEN** an entry would require judgement about naming or structure
- **THEN** it SHALL be excluded, because that is the work the guide argues you
  should do rather than automate
