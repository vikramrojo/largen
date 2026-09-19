# Spec Delta

## MODIFIED Requirements

### Requirement: Prefer platform elements
Where HTML provides an element for a pattern, the library SHALL style that
element rather than define a replacement component, and an authored component
SHALL follow the same rule: a coined tag is for containers with no interactive
or landmark role, and where the pattern has such a role, the component SHALL be
a class on the native element that carries it, or SHALL declare the role
explicitly.

#### Scenario: A modal is required
- **WHEN** a project needs a modal dialog
- **THEN** `<dialog>` SHALL be used and is already themed

#### Scenario: A disclosure is required
- **WHEN** a project needs a collapsible section
- **THEN** `<details>` SHALL be used and is already themed

#### Scenario: A component styles a role-less container
- **WHEN** a project authors a component such as a notification or a card,
  whose pattern has no interactive or landmark role
- **THEN** a coined tag such as `<notification>` SHALL be permitted, because
  the class spelling and the tag spelling are equivalent to the algebra

#### Scenario: A component's pattern has an interactive or landmark role
- **WHEN** a project authors a component for a pattern that is a button, a
  navigation region, a dialog, or another pattern with a native element
- **THEN** the component SHALL be authored as a class on that native element,
  or the coined element SHALL carry an explicit role and the behaviour the
  role implies
- **AND** a bare coined tag SHALL NOT be the documented spelling, because it
  renders styled and inert: no role, no accessible name, no keyboard behaviour
