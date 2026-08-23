# package-distribution Specification

## Purpose
TBD - created by archiving change publish-largen. Update Purpose after archive.
## Requirements
### Requirement: The package declares its contents explicitly
The published package SHALL list the files it ships by name rather than by directory,
and SHALL contain nothing that only serves the repository. Naming files individually
protects against shipping too much and not against shipping too little, so every
published command SHALL additionally be shown to run from an installed package.

#### Scenario: The package is inspected before publishing
- **WHEN** the package contents are listed
- **THEN** they SHALL contain the stylesheets, the importable modules, the skill file
  and the CLI commands that work when installed
- **AND** SHALL NOT contain site generation code, site content, or an example site's
  build output

#### Scenario: A repository-only script is added later
- **WHEN** a new script is added under the CLI directory
- **THEN** it SHALL NOT be published unless it is named explicitly

#### Scenario: A published command imports a module of its own
- **WHEN** a published command imports another module from the package
- **THEN** that module SHALL be named in the published file list
- **AND** the omission SHALL be caught by running the command from an installed
  package, not by reading the list, since a list of names cannot show what is missing

#### Scenario: A published command reads a file the package does not ship
- **WHEN** a published command's inputs include something deliberately absent from the
  package, such as an example site
- **THEN** the command SHALL skip that input and report which one it skipped and why
- **AND** SHALL complete its remaining work rather than failing

### Requirement: Installed commands operate on the consumer's project
A CLI command that examines CSS SHALL examine the files of the project invoking it.

#### Scenario: A consumer verifies their own components
- **WHEN** a consumer runs the verify command in their project, with or without paths
- **THEN** it SHALL check their component CSS
- **AND** SHALL NOT check the library's own source

#### Scenario: The library's own invariants are checked
- **WHEN** the verify command runs while developing the library itself
- **THEN** it SHALL additionally check the invariants that only apply to the library —
  slot registration, the paint rule's fallbacks, and layer order

#### Scenario: A consumer runs a command that needs the site
- **WHEN** a consumer invokes a command whose implementation is not published
- **THEN** it SHALL report that the command is for developing the library
- **AND** the CLI SHALL remain usable for every other command

### Requirement: A command requiring an unavailable dependency says so
A command depending on something outside the package SHALL name what is missing.

#### Scenario: A missing external dependency
- **WHEN** a consumer invokes a command that needs something the package does not
  and cannot contain
- **THEN** the message SHALL identify what is missing
- **AND** SHALL NOT surface as a module resolution error

#### Scenario: The bundler is absent
- **WHEN** the build command cannot resolve the bundler
- **THEN** that is a packaging defect and not a missing dependency, because the
  bundler is part of the package rather than a third-party toolchain
- **AND** it SHALL be prevented by the install test, since there is no message the
  CLI can usefully print about a module it was supposed to ship and did not

### Requirement: The importable modules are the reason to depend on largen
The package SHALL export the validator and the linter as modules, so that hosted and
local checking cannot diverge.

#### Scenario: An application validates model output
- **WHEN** an application imports the validator and validates a specification
- **THEN** the verdict SHALL match the hosted server's verdict for the same input

#### Scenario: A project lints its components in CI
- **WHEN** a project imports the linter
- **THEN** it SHALL apply the same rules the hosted checker applies

### Requirement: The repository carries the metadata a public project needs
The project SHALL ship a licence file and declare its repository, homepage and issue
location.

#### Scenario: The licence is checked
- **WHEN** the package declares a licence
- **THEN** the corresponding licence file SHALL be present in the package

#### Scenario: A reader arrives from the registry
- **WHEN** a reader finds the package on a registry
- **THEN** it SHALL link to the source repository and to the documentation site

### Requirement: The library builds with no third-party code
Producing the distribution artifacts SHALL require nothing beyond the library's own
source and a JavaScript runtime.

#### Scenario: Building from a clean checkout
- **WHEN** the build command is run in a checkout with no packages installed
- **THEN** it SHALL produce the distribution artifacts
- **AND** SHALL NOT require an install step first

#### Scenario: A transform would need a third-party toolchain
- **WHEN** a proposed build transform can only be done by a third-party CSS toolchain
- **THEN** it SHALL be rejected, or the artifact SHALL do without it
- **AND** the reasoning SHALL be recorded with the measurement that justified it

#### Scenario: A project wants more than the library's own bundler does
- **WHEN** a project needs minification, syntax lowering or scoping beyond inlining
  imports and squeezing whitespace
- **THEN** the documentation SHALL point it at an external tool for its own stylesheet
- **AND** SHALL NOT make that tool a dependency of largen

### Requirement: The bundler does not change what the CSS means
Bundling SHALL be limited to operations that cannot alter which elements a rule
matches or what it computes to.

#### Scenario: A selector contains a descendant combinator before a pseudo-class
- **WHEN** a selector such as `.prose :is(h1, h2)` is bundled
- **THEN** the combinator SHALL be preserved
- **AND** the selector SHALL NOT become a compound selector

#### Scenario: A declaration value contains comment or block delimiters
- **WHEN** a string value contains `/*`, `{`, `}` or `;`
- **THEN** it SHALL be emitted unchanged

#### Scenario: A rule sets a shorthand and then a longhand
- **WHEN** a rule sets `border` and then `border-block-start`
- **THEN** source order SHALL be preserved

#### Scenario: The bundled stylesheet is checked
- **WHEN** the built stylesheet is tested in a browser
- **THEN** it SHALL pass the same conformance assertions the source passes

### Requirement: Every published version is recorded, and the record is checked
The project SHALL keep a release log keyed by version, and SHALL verify each entry
against the bytes that version froze rather than accepting it as written.

#### Scenario: A release is published
- **WHEN** a version is frozen at its immutable path
- **THEN** the log SHALL have an entry for it
- **AND** a published version with no entry SHALL be reported as an error

#### Scenario: An entry claims something the build does not contain
- **WHEN** an entry asserts a string is present in that version's frozen stylesheet
  and it is not, or asserts one is absent and it is present
- **THEN** the check SHALL fail and name the version and the claim

#### Scenario: The newest entry has not been frozen yet
- **WHEN** an entry names a version that is not yet published
- **THEN** it SHALL be reported as pending rather than as an error, because the
  entry is written before the freeze

#### Scenario: The log and the package version disagree
- **WHEN** the newest entry's version differs from the package's version
- **THEN** the check SHALL fail

#### Scenario: The published log is derived, not maintained
- **WHEN** the human-readable log is produced
- **THEN** it SHALL be generated from the same data the check reads
- **AND** regenerating it SHALL be part of the contract check, so it cannot drift

### Requirement: The contract check covers every generated surface
A check that a generated file is current SHALL cover every file that is generated.

#### Scenario: A generated surface is stale
- **WHEN** any generated surface differs from what the generator would produce
- **THEN** the check SHALL fail and name that file
- **AND** it SHALL NOT report success on the strength of the surfaces it did open,
  because a partial check is believed exactly as much as a complete one

