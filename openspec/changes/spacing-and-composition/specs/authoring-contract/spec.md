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
