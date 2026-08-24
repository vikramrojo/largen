## MODIFIED Requirements

### Requirement: Verification resolves the cascade, and says what it did not check
`largen verify` SHALL check the caller's components against the authoring contract
AND resolve the cascade across their stylesheets. It SHALL state which of those it
performed, SHALL NOT claim to observe rendering, and SHALL name the tier that does.

#### Scenario: A component's declaration never wins
- **WHEN** a component sets a slot inside `@layer largen.components` and another
  stylesheet's declaration wins for an element matching that component's selector
- **THEN** verification SHALL fail
- **AND** SHALL name the declaration, the value that wins, and where it comes from
- **AND** SHALL identify which cascade step decided it, because a component that
  is correct in a file that is correct does not look like a layer problem

#### Scenario: Static checks pass
- **WHEN** `largen verify` reports success
- **THEN** it SHALL also direct the reader to render the demo pages in a browser

#### Scenario: Verification reports success
- **WHEN** `largen verify` reports success
- **THEN** it SHALL state what was checked and what was not
- **AND** SHALL NOT describe itself with one word that covers both
- **AND** SHALL direct the reader to the tool that observes rendering

#### Scenario: An agent loops on the result
- **WHEN** a generate → validate → repair loop consumes the result
- **THEN** a component that does not apply SHALL NOT be reported as clean, because
  the loop terminates on success and would return a broken component believing it
  correct
- **AND** a finding SHALL be clearable by the repair it describes, since a finding
  that survives a correct repair is a loop that cannot exit

#### Scenario: The reader asks what does check rendering
- **WHEN** verification states that it does not observe rendering
- **THEN** it SHALL name the conformance suite and the probe command, so that the
  limit is a pointer rather than only a disclaimer
