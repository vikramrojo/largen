## ADDED Requirements

### Requirement: The conformance assertions are executed, not published
largen SHALL execute its own conformance assertions in a browser as part of its
test suites, rather than publishing a page that asserts them and relying on a
person to open it.

#### Scenario: An assertion fails
- **WHEN** any conformance assertion fails
- **THEN** the runner SHALL exit non-zero and name the assertion that failed

#### Scenario: The suite is run
- **WHEN** the conformance runner is invoked
- **THEN** it SHALL drive the same page the documentation points readers at, rather
  than a second copy of the assertions maintained alongside it

#### Scenario: The page reports fewer checks than it contains
- **WHEN** the number of assertions the page reports is fewer than the number its
  source defines
- **THEN** the runner SHALL fail
- **AND** a page reporting zero of zero passed SHALL NOT be treated as success,
  because a harness that verifies nothing passes everything

#### Scenario: No browser is available
- **WHEN** the runner cannot start a browser
- **THEN** it SHALL report that the assertions did not run
- **AND** SHALL NOT report success, since a suite that quietly passes when it never
  executed is the failure this requirement exists to prevent

### Requirement: Conformance results are machine-readable
The conformance page SHALL publish its results in a form a driver can read without
evaluating script, in addition to the form a person reads.

#### Scenario: A driver reads the results
- **WHEN** the page has finished running
- **THEN** the per-assertion outcomes and the totals SHALL be present in the
  document itself
- **AND** the human-readable table SHALL remain, because the page is documentation
  as well as a test

### Requirement: All four axes are proven to reach every reference component
largen SHALL verify that each reference component responds to tone, variant, size
and theme, since a component acquiring all four for free is the library's central
claim.

#### Scenario: The axis matrix is resolved
- **WHEN** the matrix is run
- **THEN** every combination of tone, variant, size and theme SHALL be resolved for
  every reference component
- **AND** a component that does not respond to an axis SHALL fail

#### Scenario: A claim needs a rendered value
- **WHEN** an assertion depends on a value that static resolution cannot produce —
  an inherited custom property, or a `color-mix()` that must resolve
- **THEN** it SHALL be rendered rather than inferred
- **AND** the boundary between what was resolved statically and what was rendered
  SHALL be stated in the result

#### Scenario: Rendering is sampled rather than exhaustive
- **WHEN** the rendered portion covers fewer states than the matrix contains
- **THEN** the sample and what it excludes SHALL be reported
- **AND** it SHALL NOT be presented as full coverage
