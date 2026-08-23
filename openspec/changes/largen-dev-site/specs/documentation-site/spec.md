## ADDED Requirements

### Requirement: The site requires no build step
The documentation site SHALL be static HTML styled with largen, served directly,
with no compilation or bundling.

#### Scenario: A documentation page is served
- **WHEN** a documentation page is requested
- **THEN** it SHALL be a hand-written HTML file referencing the stylesheet
- **AND** no build SHALL have been run to produce it

#### Scenario: The library changes
- **WHEN** the stylesheet is updated
- **THEN** the site SHALL reflect the change without a rebuild

### Requirement: The site is built with largen
The site SHALL use largen for its own styling.

#### Scenario: A visitor inspects the site
- **WHEN** a visitor views the source of any page
- **THEN** the page SHALL demonstrate the library's own authoring pattern

### Requirement: LLM-readable documentation
The site SHALL publish `/llms.txt` and `/llms-compact.txt` per the llms.txt
convention.

#### Scenario: A model fetches the compact file
- **WHEN** a model fetches `/llms-compact.txt`
- **THEN** it SHALL receive the whole authoring contract inline, sufficient to
  author a component without fetching anything else

### Requirement: A spec playground
The site SHALL provide a page that renders a spec.

#### Scenario: A preview URL from `render_spec` is opened
- **WHEN** a URL returned by `render_spec` is opened
- **THEN** the rendered spec SHALL be displayed

#### Scenario: A spec is shared without server storage
- **WHEN** a spec is encoded into the URL fragment
- **THEN** the playground SHALL render it without a server round-trip

#### Scenario: An invalid spec reaches the playground
- **WHEN** the spec fails validation
- **THEN** the playground SHALL display the validation errors rather than
  rendering partial output

### Requirement: Stylesheet delivery
The site SHALL serve the stylesheet at a stable path and at versioned paths.

#### Scenario: A page links the current stylesheet
- **WHEN** a page links the unversioned path
- **THEN** it SHALL receive the current release

#### Scenario: The served stylesheet is compared with the built one
- **WHEN** the served stylesheet is compared with the library's build output
- **THEN** they SHALL be identical
- **AND** the served copy SHALL be produced from the build rather than copied by
  hand
