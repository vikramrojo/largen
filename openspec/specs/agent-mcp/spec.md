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
known failure modes. It SHALL also identify the build it was generated from.

#### Scenario: An agent is about to author a component
- **WHEN** an agent calls `get_contract`
- **THEN** it SHALL receive the slot names, the axis values, and the requirement
  to declare inside `@layer largen.components`, without reading the library source

#### Scenario: A section is requested
- **WHEN** `get_contract` is called with a `section` argument
- **THEN** only that section SHALL be returned

#### Scenario: A vendored copy is checked for drift
- **WHEN** a caller has vendored the library and needs to know whether the
  contract it holds still matches
- **THEN** the response SHALL carry a build identifier
- **AND** that identifier SHALL distinguish builds that share a version string

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
authoring contract, accepting either one stylesheet or several at once.

#### Scenario: Several stylesheets are submitted
- **WHEN** a caller submits more than one stylesheet in a single call
- **THEN** findings SHALL be returned per stylesheet, each identifying which one
  it came from
- **AND** a caller SHALL NOT have to make one call per file to lint a project

#### Scenario: One stylesheet is submitted
- **WHEN** a caller submits a single stylesheet in the original form
- **THEN** it SHALL continue to work, because the tool has callers already

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

### Requirement: A cross-file layer-order check
The server SHALL provide a tool that resolves cascade layer order across a set of
stylesheets and reports where the resulting order differs from the order declared.

#### Scenario: A layer sorts other than where it was declared
- **WHEN** a layer statement lists layers in an order the document cannot produce,
  because a layer was already positioned by an earlier mention
- **THEN** the tool SHALL report which layer sorts where, and why

#### Scenario: Sublayers of one parent are declared on both sides of another layer
- **WHEN** two sublayers of a shared parent are declared either side of a third
  layer
- **THEN** the tool SHALL report that they cannot straddle it, because a sublayer
  takes its parent's position

#### Scenario: A framework's base layer sorts after the library
- **WHEN** another framework's base layer is positioned after largen's layers
- **THEN** the tool SHALL report it, since layer order beats specificity and no
  selector weight recovers it

#### Scenario: The declared order is achievable
- **WHEN** the resolved order matches the declared order
- **THEN** the tool SHALL report success

### Requirement: A property-to-slot lookup
The server SHALL provide a tool answering whether a given CSS property is driven
by a slot, and which.

#### Scenario: A property is driven by a slot
- **WHEN** a caller asks about a property the paint rule consults
- **THEN** the tool SHALL name the slot

#### Scenario: A property is not driven by a slot
- **WHEN** a caller asks about a property outside the paint rule
- **THEN** the tool SHALL say so
- **AND** SHALL state that it is written as a plain declaration in the component

#### Scenario: The set of slots changes
- **WHEN** a slot is added or removed from the library
- **THEN** the tool's answers SHALL follow without a separate edit

### Requirement: Build identity is retrievable
The server SHALL expose the checksums of the stylesheets it serves, so a vendored
copy can be checked for drift without fetching and hashing each file by hand.

#### Scenario: A consumer has vendored a stylesheet
- **WHEN** a consumer needs to know whether their copy matches what is served
- **THEN** they SHALL be able to obtain the digest of the served bytes

#### Scenario: Two builds share a version string
- **WHEN** the same version names more than one build
- **THEN** the digest SHALL distinguish them
- **AND** the version SHALL NOT be presented as sufficient to identify a build

