# hosting Specification

## Purpose
TBD - created by archiving change largen-dev-site. Update Purpose after archive.
## Requirements
### Requirement: The service survives restarts
The service SHALL run under a process supervisor and restart automatically.

#### Scenario: The process exits unexpectedly
- **WHEN** the server process exits
- **THEN** it SHALL be restarted without manual intervention

#### Scenario: The machine reboots
- **WHEN** the host reboots
- **THEN** the service SHALL start automatically

### Requirement: TLS
The site and MCP endpoint SHALL be served over HTTPS.

#### Scenario: A plaintext request arrives
- **WHEN** a request arrives over HTTP
- **THEN** it SHALL be redirected to HTTPS

#### Scenario: TLS termination is determined
- **WHEN** deployment configuration is written
- **THEN** whether the host already terminates TLS SHALL have been established
  first, so a redundant reverse proxy is not introduced

### Requirement: Versioned paths are immutable
Once published, a versioned stylesheet path SHALL always return the same bytes.

#### Scenario: A new version is released
- **WHEN** a new version is published
- **THEN** previously published versioned paths SHALL be unchanged

### Requirement: Health is observable
The service SHALL expose a health endpoint reporting its status and version.

#### Scenario: The service is checked after deployment
- **WHEN** the health endpoint is requested
- **THEN** it SHALL report the running version of the library it is serving

### Requirement: Runtime prerequisites are verified before deployment
The host's runtime version SHALL be confirmed to satisfy the server's
requirements before deployment configuration is finalised.

#### Scenario: The runtime is too old
- **WHEN** the host's Node version does not support the server's dependencies
- **THEN** this SHALL be resolved before deploying, not discovered at runtime

