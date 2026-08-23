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
Token names SHALL be distinguishable from slot names, so that setting one is
never mistaken for setting the other.

Where a token supplies the document-wide default for a property that also has a
slot, the two SHALL be named as a pair: the token carrying a `-base` suffix and
the slot carrying the property's name.

#### Scenario: A token is named
- **WHEN** a token is added
- **THEN** its name SHALL NOT match any registered slot

#### Scenario: A property has both a document default and a per-component slot
- **WHEN** a property such as font-size or line-height has both
- **THEN** the token SHALL be the slot's name with `-base` appended
- **AND** the relationship SHALL be evident from the names alone

#### Scenario: A document default is set on the root
- **WHEN** the reset applies a base token to the document
- **THEN** it SHALL use a value that inherits, so descendants recompute it
- **AND** SHALL NOT use a slot, because a slot does not inherit and descendants
  would revert to the user-agent value instead

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

