## ADDED Requirements

### Requirement: The reference set is both a worked example and shippable
The reference components SHALL be complete enough to build an ordinary interface
without authoring anything, while remaining small enough to read and copy.

#### Scenario: A project needs a common interface element
- **WHEN** a project needs a form field, a scrollable table, a toolbar or an empty
  state
- **THEN** the reference set SHALL provide one

#### Scenario: A reader wants to learn the pattern
- **WHEN** a reader opens any reference component's source
- **THEN** it SHALL be short enough to read in full, set slots only, and mention no
  colour literal, no raw semantic token, no dark-mode rule and no size variant

### Requirement: The set is taken by copying, not by depending
The reference components SHALL be delivered as source to copy into a project, and
SHALL NOT become an interface a project inherits from.

#### Scenario: A project takes one component
- **WHEN** a project wants one reference component
- **THEN** its source SHALL be retrievable on its own
- **AND** the project SHALL be free to edit it without regard to the library

#### Scenario: A component's shape changes in a later release
- **WHEN** a reference component is changed
- **THEN** projects that copied it SHALL be unaffected

### Requirement: Bare elements are themed rather than duplicated as components
An interface element that HTML already provides SHALL be themed as that element, and
SHALL NOT be reproduced as a component class.

#### Scenario: An element already exists in HTML
- **WHEN** the platform provides an element for a need, such as `progress`, `meter`,
  `dialog` or `details`
- **THEN** the library SHALL theme the element
- **AND** SHALL NOT ship a component class duplicating it

#### Scenario: A reader looks for a button component
- **WHEN** a reader looks for a button in the reference set
- **THEN** there SHALL be none, because `button` is themed and already answers to tone,
  variant and size

### Requirement: Every component is shown rendered, with its source
The documentation SHALL present each reference component rendered, in both themes,
alongside the CSS that produces it.

#### Scenario: A reader opens the components page
- **WHEN** a reader opens the components documentation
- **THEN** each component SHALL appear rendered rather than only named
- **AND** its source SHALL be shown beside it
- **AND** the axes it responds to SHALL be stated

#### Scenario: A component is added or changed
- **WHEN** the reference stylesheet changes
- **THEN** the page SHALL reflect it after regeneration, with no separate edit

### Requirement: Examples are validated, not hand-written markup
The markup shown for each component SHALL be produced from a validated specification
rather than authored as HTML.

#### Scenario: An example names an unknown component
- **WHEN** an example names a component absent from the manifest
- **THEN** generation SHALL fail
- **AND** SHALL NOT emit a page containing the unknown component

#### Scenario: The page and the MCP server are compared
- **WHEN** the same specification is rendered for the page and by `render_spec`
- **THEN** the output SHALL be identical, because one validator and one renderer produce
  both
