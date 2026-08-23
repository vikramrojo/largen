## ADDED Requirements

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
The CLI SHALL provide `build`, `verify` and `gen`, and none SHALL be required to
use the library.

#### Scenario: A project never runs the CLI
- **WHEN** a project installs largen and never invokes the CLI
- **THEN** the library SHALL be fully usable

### Requirement: Verification is known to be partial
`largen verify` SHALL perform static checks only, and SHALL state that it cannot
observe rendering.

#### Scenario: Static checks pass
- **WHEN** `largen verify` reports success
- **THEN** it SHALL also direct the reader to render the demo pages in a browser

### Requirement: Browser floor
The library SHALL require Safari 16.4+, Chrome 111+ and Firefox 128+, and SHALL
NOT provide a fallback path.

#### Scenario: An older browser loads the stylesheet
- **WHEN** a browser lacking `@property` or `revert-layer` loads largen
- **THEN** the library SHALL be documented as unsupported rather than degrade
  silently
