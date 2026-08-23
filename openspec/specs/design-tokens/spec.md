# design-tokens Specification

## Purpose
TBD - created by archiving change build-largen. Update Purpose after archive.
## Requirements
### Requirement: Material token vocabulary
The library SHALL expose surface tokens named `--canvas`, `--ink`, `--ink-muted`,
`--surface` and `--line`, and semantic tone tokens each paired with an on-colour
(`--primary`/`--primary-on`, and likewise for secondary, success, info, warning,
danger and neutral).

#### Scenario: A solid variant is rendered
- **WHEN** a component renders with `data-variant="solid"`
- **THEN** its text SHALL use the tone's on-colour, so contrast holds

### Requirement: Token names cannot collide with slots
No token name SHALL be identical to a paint slot name.

#### Scenario: A token is added
- **WHEN** a token is introduced with the same name as a slot
- **THEN** it SHALL be renamed, because the slot would be shadowed and the
  universal paint rule would read the token

### Requirement: Theme contract
A theme SHALL set tokens only. It SHALL NOT reference a component, a slot, or a
variant.

#### Scenario: The theme is switched to dark
- **WHEN** `data-theme="dark"` is set on the document
- **THEN** every component, variant and size SHALL follow from the token
  overrides alone
- **AND** no per-component dark rule SHALL exist anywhere in the library

#### Scenario: A component appears wrong only in dark mode
- **WHEN** a component requires its own dark-mode rule to look correct
- **THEN** this SHALL be treated as a defect in the algebra, not fixed in the
  component

### Requirement: Extended hues
The library SHALL provide a named hue set beyond the semantic tones, for projects
whose components exceed seven semantic categories.

#### Scenario: A project needs more categories than there are tones
- **WHEN** a project defines 24 callout types
- **THEN** each SHALL be expressible by setting `--tone` to a hue token in a
  single declaration

