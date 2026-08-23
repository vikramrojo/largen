# agent-mcp Specification

## Purpose
TBD - created by archiving change largen-dev-site. Update Purpose after archive.
## Requirements
### Requirement: Transport and endpoint
The server SHALL expose an MCP endpoint at `/api/mcp` using Streamable HTTP
transport, and SHALL NOT require authentication.

#### Scenario: A client connects
- **WHEN** a client connects to `https://largen.dev/api/mcp` with no credentials
- **THEN** the connection SHALL succeed
- **AND** the server SHALL advertise its tools with their input schemas

#### Scenario: A client uses the documented install command
- **WHEN** a user runs `claude mcp add largen --transport http https://largen.dev/api/mcp`
- **THEN** the server SHALL be usable without further configuration

### Requirement: Tools accept a project's own component manifest
Every tool that reasons about components SHALL accept an optional `components`
manifest parameter, and SHALL use it in place of largen's reference set.

#### Scenario: A manifest is supplied
- **WHEN** a tool is called with a `components` manifest describing a project's
  own components
- **THEN** the tool SHALL answer in terms of those components
- **AND** SHALL NOT report largen's reference components

#### Scenario: No manifest is supplied
- **WHEN** a tool is called without a `components` manifest
- **THEN** the tool SHALL fall back to largen's reference component set

#### Scenario: A malformed manifest is supplied
- **WHEN** the supplied manifest does not conform to the manifest schema
- **THEN** the tool SHALL return an error identifying the problem
- **AND** SHALL NOT fall back silently to the reference set

### Requirement: The server is stateless
The server SHALL hold no per-client state between calls, other than rendered
previews addressed by id.

#### Scenario: The service restarts between two calls
- **WHEN** a client calls a tool, the service restarts, and the client calls again
  with the same arguments
- **THEN** the second result SHALL equal the first

### Requirement: `get_contract`
The server SHALL provide a tool returning the authoring contract: the slots, the
axes and their permitted values, the layer rule, the authoring rules, and the
known failure modes.

#### Scenario: An agent is about to author a component
- **WHEN** an agent calls `get_contract`
- **THEN** it SHALL receive the slot names, the axis values, and the requirement
  to declare inside `@layer largen.components`, without reading the library source

#### Scenario: A section is requested
- **WHEN** `get_contract` is called with a `section` argument
- **THEN** only that section SHALL be returned

### Requirement: `list_components`
The server SHALL provide a tool returning the component catalog, with each
component's name, description, element, slots, and permitted children.

#### Scenario: An agent needs to know what it may emit
- **WHEN** an agent calls `list_components`
- **THEN** it SHALL receive every component it is permitted to name in a spec

### Requirement: `get_component_source`
The server SHALL provide a tool returning the CSS source of a named reference
component, for copying into a project.

#### Scenario: A known component is requested
- **WHEN** `get_component_source` is called with a reference component's name
- **THEN** the CSS for that component SHALL be returned

#### Scenario: An unknown name is requested
- **WHEN** the name does not match a reference component
- **THEN** an error SHALL be returned
- **AND** the name SHALL NOT be used to construct a filesystem path

### Requirement: `validate_spec`
The server SHALL provide a tool validating a model-emitted node tree, returning
success or a list of errors each identifying a path and a reason.

#### Scenario: A valid spec is submitted
- **WHEN** a spec naming permitted components and axis values is submitted
- **THEN** the tool SHALL report success

#### Scenario: A spec carries an injected property
- **WHEN** a node includes `style`, `onclick`, `className` or
  `dangerouslySetInnerHTML`
- **THEN** the tool SHALL reject the node rather than drop the property

#### Scenario: A spec names an unknown component or axis value
- **WHEN** a node names a component absent from the catalog, or a tone, variant
  or size outside the permitted values
- **THEN** the tool SHALL reject it, identifying the path

#### Scenario: Hosted validation is compared with local validation
- **WHEN** the same spec is validated by the tool and by the library's local
  validator
- **THEN** both SHALL reach the same verdict

### Requirement: `check_component_css`
The server SHALL provide a tool that lints authored component CSS against the
authoring contract.

#### Scenario: A component is declared outside the components layer
- **WHEN** submitted CSS declares a component outside `@layer largen.components`
- **THEN** the tool SHALL report it
- **AND** SHALL explain that `data-variant` will silently stop applying while
  tone and size continue to work

#### Scenario: A component contains a colour literal
- **WHEN** submitted CSS contains a hex, `rgb()`, `hsl()` or `oklch()` value
- **THEN** the tool SHALL report it

#### Scenario: A component bypasses the tone axis
- **WHEN** submitted CSS references a raw semantic token such as `--danger`
  instead of `--tone` or one of its derivations
- **THEN** the tool SHALL report it

#### Scenario: A component uses an unregistered slot
- **WHEN** submitted CSS sets a custom property that is not a registered slot
- **THEN** the tool SHALL report it as having no effect on paint

#### Scenario: A correct component is submitted
- **WHEN** submitted CSS satisfies every rule
- **THEN** the tool SHALL report success with no findings

### Requirement: `render_spec`
The server SHALL provide a tool that validates a spec, renders it to HTML, and
returns both the HTML and a preview URL.

#### Scenario: A valid spec is rendered
- **WHEN** a valid spec is submitted
- **THEN** the tool SHALL return the rendered HTML inline
- **AND** SHALL return a URL at which the same rendering can be viewed

#### Scenario: An invalid spec is submitted
- **WHEN** the spec fails validation
- **THEN** the tool SHALL return validation errors
- **AND** SHALL NOT produce a preview URL

#### Scenario: A theme is requested
- **WHEN** the tool is called with a `theme` argument
- **THEN** the rendering SHALL use that theme

#### Scenario: Project CSS is supplied
- **WHEN** the tool is called with a `css` argument containing the project's
  component definitions
- **THEN** the rendering SHALL include it, so the project's own components appear
  as they do in the project

