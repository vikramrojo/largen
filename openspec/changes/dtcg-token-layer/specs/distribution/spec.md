# Spec Delta

## MODIFIED Requirements

### Requirement: Distribution artifacts
`dist/` SHALL contain minified concatenations of the source, and SHALL be
byte-equivalent in behaviour to importing the source directly. It SHALL also
contain the token documents derived from the source — the defaults and each
shipped theme in DTCG JSON — each recorded in the build manifest with the same
digests as the stylesheets.

#### Scenario: A consumer uses dist
- **WHEN** a consumer links `dist/largen.css` instead of `src/largen.css`
- **THEN** rendering SHALL be identical

#### Scenario: A consumer reads the token documents
- **WHEN** a consumer reads `dist/largen.tokens.json`
- **THEN** its values SHALL equal those in `src/tokens.css`, and
  `dist/build.json` SHALL carry its digest

### Requirement: Optional tooling
The CLI SHALL provide `build`, `verify`, `gen`, `manifest`, `probe`, `cascade`,
`slot` and `theme`, and none SHALL be required to use the library.

#### Scenario: A project never runs the CLI
- **WHEN** a project installs largen and never invokes the CLI
- **THEN** the library SHALL be fully usable

#### Scenario: A command is added
- **WHEN** a command is added to the CLI
- **THEN** it SHALL be optional in the same sense
- **AND** the library SHALL NOT acquire a build step by acquiring a tool

#### Scenario: A theme is written by hand
- **WHEN** a project writes its theme stylesheet directly rather than from a
  token document
- **THEN** it SHALL be a valid theme, and the theme command SHALL be a
  convenience, not a requirement
