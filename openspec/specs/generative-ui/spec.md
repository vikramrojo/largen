# generative-ui Specification

## Purpose
TBD - created by archiving change build-largen. Update Purpose after archive.
## Requirements
### Requirement: An approved-component allowlist
The repository SHALL provide a manifest naming the components a model may emit
and the permitted values of each axis.

#### Scenario: A project defines its own components
- **WHEN** a project replaces the manifest's component list with its own
- **THEN** the derived artifacts SHALL be regenerable by `largen gen`

### Requirement: Derived artifacts are generated, never hand-edited
`schema.json`, `prompt.md` and `manifest.js` SHALL be generated from
`manifest.json`.

#### Scenario: A derived artifact is edited by hand
- **WHEN** `schema.json` is edited directly
- **THEN** the next `largen gen` SHALL overwrite it, and the edit SHALL be
  treated as a defect

### Requirement: Structural safety
The validated output SHALL contain no field capable of expressing a colour, a
class, inline CSS, or an event handler.

#### Scenario: A model emits a style attribute
- **WHEN** a node includes `style`, `onclick`, `className` or
  `dangerouslySetInnerHTML`
- **THEN** validation SHALL reject the node rather than drop the property

#### Scenario: A model emits an unknown component
- **WHEN** a node names a component absent from the manifest
- **THEN** validation SHALL reject it

#### Scenario: A model emits an unknown axis value
- **WHEN** a node sets a tone, variant or size outside the permitted values
- **THEN** validation SHALL reject it

### Requirement: Containment rules
The manifest SHALL express which components may nest inside which, and validation
SHALL enforce it.

#### Scenario: A disallowed child is emitted
- **WHEN** a node nests a component its parent does not permit
- **THEN** validation SHALL reject it, identifying the path

### Requirement: Bounded input
Validation SHALL bound nesting depth and child count.

#### Scenario: A deeply nested node is emitted
- **WHEN** nesting exceeds the permitted depth
- **THEN** validation SHALL reject the node

