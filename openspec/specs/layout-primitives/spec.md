# layout-primitives Specification

## Purpose
TBD - created by archiving change build-largen. Update Purpose after archive.
## Requirements
### Requirement: The layout utility set
The library SHALL provide exactly these layout utilities: `stack`, `row`,
`cluster`, `center`, `grid`, `switcher` and `sidebar`, each configured by custom
properties rather than by variant classes.

#### Scenario: Spacing is changed
- **WHEN** a project needs a different gap on a `stack`
- **THEN** it SHALL set `--gap` rather than use a different class

### Requirement: Layout utilities are components
Layout utilities SHALL set paint slots and SHALL be painted by the same universal
rule as any other component.

#### Scenario: A layout utility sets a gap
- **WHEN** `stack` sets `--gap`
- **THEN** the universal paint rule SHALL apply it, with no layout-specific
  mechanism

### Requirement: Intrinsic responsiveness
`switcher` and `sidebar` SHALL reflow on available container width without media
queries, and the library SHALL NOT define a breakpoint variant system.

#### Scenario: A switcher is narrower than its minimum item width
- **WHEN** a `switcher` container is narrower than `--min-item`
- **THEN** its children SHALL each occupy a full line
- **AND** this SHALL depend on container width, not viewport width

#### Scenario: A sidebar's main column becomes too narrow
- **WHEN** the main column of a `sidebar` would fall below `--min-content`
- **THEN** the two columns SHALL stack

### Requirement: Lists used as layout containers
A `<ul>` or `<ol>` carrying a layout utility SHALL have its markers and
user-agent indentation removed.

#### Scenario: An ordered list is used for pagination
- **WHEN** an `<ol>` carries `cluster`
- **THEN** it SHALL render horizontally with no numbering and no indent

