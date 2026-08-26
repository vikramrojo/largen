## ADDED Requirements

### Requirement: The contract teaches composition, not only constraint
The contract SHALL carry guidance on composing a page, alongside its guidance on
what largen guarantees and how it fails.

#### Scenario: A page is built to the rules alone
- **WHEN** an author follows every rule the contract states
- **THEN** the contract SHALL also have told them how to use space, elevation, and
  what a slot cannot express
- **AND** this material SHALL be reachable in the same document, since a page built
  to the rules alone was measured to come out correct and plain

#### Scenario: The compact file carries it
- **WHEN** `llms-compact.txt` is generated
- **THEN** the composition material SHALL be included in full rather than pointed
  at, because the improvement it produced was measured with the material present
  in the prompt and a pointer would reproduce the original result

#### Scenario: A section is requested over MCP
- **WHEN** `get_contract` is called for the composition section
- **THEN** it SHALL be served like any other section of the contract

### Requirement: The compact contract's budget moves only with evidence
The size of `llms-compact.txt` SHALL be checked against a stated budget, and
exceeding it SHALL be reported. Raising the budget SHALL be recorded with the
reason.

#### Scenario: The compact file exceeds the budget
- **WHEN** the generated file is larger than the budget
- **THEN** the generator SHALL warn, and SHALL say that trimming or splitting is
  preferred to raising the limit

#### Scenario: The budget is raised
- **WHEN** the budget is changed
- **THEN** the reason SHALL be recorded where the number is set
- **AND** it SHALL rest on evidence about what the added material does, not on the
  fact that the old number was in the way

### Requirement: The contract documents the utilities it ships
Every layout utility the library ships SHALL be described in the compact contract
by what it does and by the custom properties it reads. Listing a utility's name
alone SHALL NOT be sufficient.

#### Scenario: An agent needs to lay out a page
- **WHEN** an agent reads the compact contract and needs a row, a stack or a grid
- **THEN** it SHALL find, for each utility, what the utility does and which
  properties configure it
- **AND** it SHALL NOT have to infer the behaviour from the name

#### Scenario: A utility is configured by a custom property
- **WHEN** a utility reads a custom property such as `--gap`, `--measure`,
  `--min-item`, `--threshold`, `--side` or `--min-content`
- **THEN** that property SHALL be named alongside the utility
- **AND** the contract SHALL make clear that utilities are configured the same way
  components are, since that is the same story the rest of the contract tells

#### Scenario: A utility is added or removed from the library
- **WHEN** the set of shipped utilities changes
- **THEN** the contract SHALL be regenerated and the check SHALL fail if it was not

### Requirement: Composition guidance is framed by what to do
Guidance about what the algebra cannot express directly SHALL be presented as an
instruction rather than filed among the failure modes.

#### Scenario: A technique has no slot
- **WHEN** an effect such as a gradient has no slot and must be written as a plain
  property beside one
- **THEN** the contract SHALL present the technique as a positive instruction
- **AND** the corresponding silent failure SHALL remain in the failure taxonomy,
  so the hazard is recorded without the recipe being filed as a hazard

### Requirement: The contract says when to reach for an axis
The composition guidance SHALL state when the tone, size and state axes are worth
reaching for, not only how they behave.

#### Scenario: A design uses no colour
- **WHEN** a design is achromatic or restrained
- **THEN** the contract SHALL make clear that the axes still apply
- **AND** SHALL NOT leave an author to infer that a tone axis is only for coloured
  designs
