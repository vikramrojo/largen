## ADDED Requirements

### Requirement: The service answers on its own domain
The site and the MCP endpoint SHALL be reachable at the project's domain over HTTPS.

#### Scenario: A visitor uses the documented address
- **WHEN** a visitor requests the project's domain over HTTPS
- **THEN** the site SHALL be served
- **AND** the MCP endpoint SHALL be reachable at that domain

#### Scenario: A plaintext request arrives at the domain
- **WHEN** a request arrives over HTTP
- **THEN** it SHALL be redirected to HTTPS

#### Scenario: The domain is registered with the host before DNS resolves
- **WHEN** the hostname is not yet registered with the platform serving it
- **THEN** requests SHALL be refused with a distinguishable response rather than served
  from a default site

### Requirement: Preview URLs use the address that was published
Generated URLs SHALL use the domain the service is reached at, so a shared link works for
its recipient.

#### Scenario: A preview URL is returned after the domain is attached
- **WHEN** `render_spec` returns a preview URL
- **THEN** it SHALL use the project's domain

#### Scenario: The previous hostname is requested
- **WHEN** the platform hostname is requested after the domain is attached
- **THEN** it SHALL continue to serve, so links shared earlier keep working
