# distribution Specification

## Purpose
TBD - created by archiving change build-largen. Update Purpose after archive.
## Requirements
### Requirement: No build step
The library SHALL function as plain CSS with no compilation, preprocessing or
plugin.

#### Scenario: The stylesheet is linked directly
- **WHEN** a page links `src/largen.css` or a CDN copy and defines components in
  a `<style>` block
- **THEN** it SHALL render correctly with no tooling having been run

#### Scenario: A change would require compilation
- **WHEN** a proposed feature can only work by generating CSS from other CSS
- **THEN** it SHALL be rejected or redesigned

### Requirement: Distribution artifacts
`dist/` SHALL contain minified concatenations of the source, and SHALL be
byte-equivalent in behaviour to importing the source directly.

#### Scenario: A consumer uses dist
- **WHEN** a consumer links `dist/largen.css` instead of `src/largen.css`
- **THEN** rendering SHALL be identical

### Requirement: Optional tooling
The CLI SHALL provide `build`, `verify`, `gen`, `manifest`, `probe`, `cascade` and
`slot`, and none SHALL be required to use the library.

#### Scenario: A project never runs the CLI
- **WHEN** a project installs largen and never invokes the CLI
- **THEN** the library SHALL be fully usable

#### Scenario: A command is added
- **WHEN** a command is added to the CLI
- **THEN** it SHALL be optional in the same sense
- **AND** the library SHALL NOT acquire a build step by acquiring a tool

### Requirement: Browser floor
The library SHALL require Safari 16.4+, Chrome 111+ and Firefox 128+, and SHALL
NOT provide a fallback path.

#### Scenario: An older browser loads the stylesheet
- **WHEN** a browser lacking `@property` or `revert-layer` loads largen
- **THEN** the library SHALL be documented as unsupported rather than degrade
  silently

### Requirement: Verification resolves the cascade, and says what it did not check
`largen verify` SHALL check the caller's components against the authoring contract
AND resolve the cascade across their stylesheets. It SHALL state which of those it
performed and SHALL NOT claim to observe rendering.

The previous version of this requirement mandated static checks only. That was
correct while nothing could resolve a cascade, and became the reason a verifier
could report success on a component that never applied.

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

### Requirement: Verification does not guess at load order
Which declaration wins depends on the order the document loads its stylesheets in.
`largen verify` SHALL derive that order or decline the checks that need it.

#### Scenario: The order can be derived
- **WHEN** an entry stylesheet is supplied, or exactly one discovered stylesheet
  imports others and is imported by none
- **THEN** the load order SHALL be derived by following its `@import` graph

#### Scenario: The order cannot be derived
- **WHEN** no entry stylesheet is supplied and none can be inferred
- **THEN** the cascade checks SHALL be reported as not run, with the reason and how
  to supply the order
- **AND** they SHALL NOT be run against the order files happened to be discovered
  in, which would answer confidently about a cascade the project does not have

#### Scenario: An import is not among the files checked
- **WHEN** the derived graph names a stylesheet that was not supplied
- **THEN** it SHALL be reported, because any layer that stylesheet declares is
  absent from the answer

#### Scenario: A stylesheet is built output
- **WHEN** the discovered stylesheets include a minified bundle
- **THEN** it SHALL be excluded from linting, whose findings would all carry line 1
- **AND** SHALL be included in the cascade, because a vendored bundle is where the
  layer order and the paint rule come from

