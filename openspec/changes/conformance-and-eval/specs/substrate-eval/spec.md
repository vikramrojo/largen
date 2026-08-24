## ADDED Requirements

### Requirement: Authored components can be scored deterministically
largen SHALL provide a command that scores a directory of authored components
against the authoring contract, producing the same result for the same input.

#### Scenario: A directory is scored
- **WHEN** the command is given a directory of component CSS
- **THEN** it SHALL report conformance to the authoring rules and the documented
  failure modes
- **AND** every metric SHALL derive from a published rule rather than an opinion
  about quality

#### Scenario: The same input is scored twice
- **WHEN** the command is run twice over unchanged input
- **THEN** it SHALL produce identical results

#### Scenario: Two directories are compared
- **WHEN** the command is given two directories
- **THEN** it SHALL report each metric for both
- **AND** SHALL NOT declare a winner, because the comparison it enables carries an
  asymmetry the numbers alone do not show

### Requirement: Scoring requires no model, key or network
The scoring command SHALL run offline and SHALL NOT depend on a language model.

#### Scenario: The command runs
- **WHEN** scoring is invoked
- **THEN** it SHALL complete with no network access and no credential
- **AND** the published package SHALL NOT acquire a dependency in order to provide it

#### Scenario: A metric would require judgement
- **WHEN** a measure cannot be derived from the contract — whether a component looks
  right
- **THEN** it SHALL be left to the agent or person running the command
- **AND** SHALL NOT be approximated by a score that appears deterministic

### Requirement: The score states what it does not measure
Results SHALL state the limits of what was measured.

#### Scenario: A component scores perfectly
- **WHEN** every metric passes
- **THEN** the result SHALL state that conformance is not appearance, and direct the
  reader to render it
- **AND** SHALL NOT describe itself in terms that imply the component is correct

#### Scenario: Results are used to compare authoring substrates
- **WHEN** the output is used to compare largen against another substrate
- **THEN** the asymmetry SHALL be stated: a substrate familiar from training data is
  being compared against one read from a contract file, so a largen win is
  conservative and a largen loss is confounded
