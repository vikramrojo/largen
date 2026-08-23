## ADDED Requirements

### Requirement: The package declares its contents explicitly
The published package SHALL list the files it ships by name rather than by directory,
and SHALL contain nothing that only serves the repository.

#### Scenario: The package is inspected before publishing
- **WHEN** the package contents are listed
- **THEN** they SHALL contain the stylesheets, the importable modules, the skill file
  and the CLI commands that work when installed
- **AND** SHALL NOT contain site generation code, site content, or an example site's
  build output

#### Scenario: A repository-only script is added later
- **WHEN** a new script is added under the CLI directory
- **THEN** it SHALL NOT be published unless it is named explicitly

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

#### Scenario: The bundler is absent
- **WHEN** a consumer invokes the build command without the bundling dependency present
- **THEN** the message SHALL identify the dependency
- **AND** SHALL NOT surface as a module resolution error

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
