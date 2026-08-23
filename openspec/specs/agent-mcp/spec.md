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
authoring contract, accepting either one stylesheet or several at once. When
given several, it SHALL classify each before linting it, and lint only those that
declare components.

#### Scenario: Several stylesheets are submitted
- **WHEN** a caller submits more than one stylesheet in a single call
- **THEN** findings SHALL be returned per stylesheet, each identifying which one
  it came from
- **AND** a caller SHALL NOT have to make one call per file to lint a project

#### Scenario: A batch contains a file that declares no components
- **WHEN** a submitted stylesheet declares nothing inside `@layer largen.components`
- **THEN** the tool SHALL classify it, report why it was not linted, and produce
  no findings for it
- **AND** SHALL NOT judge it by the component content rules, which would report
  every token as a colour literal in an undeclared component
- **AND** the count of linted files and the count of skipped files SHALL both be
  reported

#### Scenario: A batch contains a component that forgot its layer
- **WHEN** a submitted stylesheet sets registered paint slots but declares them
  outside `@layer largen.components`
- **THEN** it SHALL be classified as a component and linted
- **AND** the missing layer SHALL be reported, because that finding is the most
  valuable one the linter has and classifying the file away would discard it on
  the strength of the very error being looked for

#### Scenario: A batch contains another largen layer
- **WHEN** a submitted stylesheet sets paint slots inside a largen layer other
  than `largen.components`
- **THEN** it SHALL be treated as library or system CSS rather than a component
  that forgot its layer

#### Scenario: A batch contains minified output
- **WHEN** a submitted stylesheet is built output rather than source
- **THEN** the tool SHALL skip it and say so, since every finding would carry line
  1 and the file it was built from is already being checked

#### Scenario: The classification matches `largen verify`
- **WHEN** the same stylesheet is judged by the CLI and by this tool
- **THEN** both SHALL reach the same classification, from one shared
  implementation

#### Scenario: One stylesheet is submitted
- **WHEN** a caller submits a single stylesheet in the original form
- **THEN** it SHALL continue to work, because the tool has callers already
- **AND** it SHALL NOT be classified away, because submitting one snippet means
  "check this component", and answering "that is not a component" would lose the
  layer finding, which is the most valuable one the linter has

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
It SHALL be able to derive the load order from an entry stylesheet's `@import`
graph rather than requiring the caller to supply it correctly.

#### Scenario: An entry stylesheet is supplied
- **WHEN** a caller names one of the submitted files as the entry
- **THEN** the tool SHALL derive load order by following `@import` within the
  submitted set, rather than trusting the order in which they were given
- **AND** SHALL report the derived order

#### Scenario: No entry stylesheet is supplied
- **WHEN** no entry is named
- **THEN** the tool SHALL use the given order
- **AND** SHALL state that it cannot verify that order, and that supplying an
  entry removes the assumption

#### Scenario: An import cannot be resolved within the submitted set
- **WHEN** an `@import` names a stylesheet that was not submitted, or a remote one
- **THEN** the tool SHALL report it as unresolved
- **AND** SHALL state that any layer that stylesheet declares is absent from the
  answer, so the absence is not read as "no layers there"

#### Scenario: A file is imported more than once, or forms a cycle
- **WHEN** the import graph reaches one stylesheet by more than one path, or
  contains a cycle
- **THEN** the stylesheet SHALL appear once, at its first position
- **AND** the derivation SHALL terminate

#### Scenario: A submitted file is never imported
- **WHEN** a submitted stylesheet is not reachable from the entry
- **THEN** the tool SHALL report it as unreached and leave it out of the order,
  rather than placing it somewhere plausible

#### Scenario: An import carries a layer condition
- **WHEN** an `@import` uses `layer()` to wrap the imported stylesheet in a layer
  that stylesheet never mentions
- **THEN** the tool SHALL report it, rather than attributing the layers to the
  wrapper or ignoring the condition

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

### Requirement: `emit_probe`
The server SHALL provide a tool that returns a self-contained HTML harness which
the caller runs against their own build, so that questions requiring a rendering
engine can be answered without the server operating one.

#### Scenario: A computed-value probe is requested
- **WHEN** a caller supplies stylesheet references, selectors, properties and
  themes
- **THEN** the tool SHALL return a single self-contained HTML document
- **AND** that document, when opened against the caller's build, SHALL report the
  computed value of each property for each selector in each theme

#### Scenario: An interaction probe is requested
- **WHEN** a caller supplies interaction steps and assertions
- **THEN** the returned document SHALL perform those steps and report each
  assertion as passed or failed
- **AND** SHALL report an assertion whose target never appeared as failed rather
  than passed, since a harness that silently verifies nothing is worse than none

#### Scenario: The server executes nothing
- **WHEN** any probe is requested
- **THEN** the server SHALL NOT parse, render, or execute the caller's markup,
  stylesheets or scripts
- **AND** the returned document SHALL be inert text as far as the server is
  concerned

#### Scenario: The probe is self-contained
- **WHEN** the returned document is opened
- **THEN** it SHALL require no network access beyond the caller's own stylesheets
- **AND** SHALL depend on no library the caller must install

### Requirement: `explain_slot`
The server SHALL provide a tool that, given stylesheets and an element's ancestor
chain, explains whether a named slot is applied by the paint rule or reverts, and
what it reverts to.

#### Scenario: A slot is set and applies
- **WHEN** a matching rule sets the slot to a usable value
- **THEN** the tool SHALL report which rule set it, in which layer, and that the
  paint rule applies it

#### Scenario: A slot resolves guaranteed-invalid
- **WHEN** the slot is unset, or is set to a keyword such as `inherit` or
  `initial` which leaves a registered slot guaranteed-invalid
- **THEN** the tool SHALL report that the paint rule's `revert-layer` fallback
  fires
- **AND** SHALL name the declaration responsible, so that `--bg: initial` in a
  compatibility rule is not read as "my class is not applying"

#### Scenario: The revert target is reported honestly
- **WHEN** a slot reverts to the user-agent stylesheet
- **THEN** any user-agent value the tool reports SHALL be labelled as
  engine-specific and illustrative
- **AND** the tool SHALL NOT present it as a computed result derived from the
  submitted stylesheets

#### Scenario: A slot is set to `inherit` on an element the UA styles
- **WHEN** `--fg: inherit` is set on an element such as a link
- **THEN** the tool SHALL warn that the slot is guaranteed-invalid and the
  property reverts to the user-agent value rather than the surrounding colour
- **AND** SHALL give `currentColor` as the recipe that inherits

### Requirement: `resolve_cascade`
The server SHALL provide a tool that, given stylesheets and an element's ancestor
chain, returns every declaration of a named property that matches, in cascade
order, identifying the winner and the reason it won.

#### Scenario: Declarations compete across layers
- **WHEN** more than one matching declaration sets the property in different
  cascade layers
- **THEN** the tool SHALL return them in cascade order with the winner identified
- **AND** SHALL give layer order as the reason, naming the layers involved

#### Scenario: A sublayer's position decides the outcome
- **WHEN** the winner is decided by a sublayer taking its parent's position rather
  than by the order it was listed in
- **THEN** the tool SHALL say so, because the symptom points elsewhere

#### Scenario: A selector cannot be decided from an ancestor chain
- **WHEN** a matching rule depends on sibling position, child index, or
  interaction state — which an ancestor chain does not carry
- **THEN** the tool SHALL report that rule as undecidable from the given chain,
  naming the selector and the reason
- **AND** SHALL NOT silently omit it, since a caller reads an omission as "no rule
  here"
- **AND** SHALL direct the caller to `emit_probe` for an answer

#### Scenario: The property is not inherited and is unset here
- **WHEN** no matching rule sets the property and the property does not inherit
- **THEN** the tool SHALL report that and stop, rather than walking the ancestor
  chain for a value that cannot arrive that way

#### Scenario: A value cannot be reduced statically
- **WHEN** a winning declaration's value contains `calc()` or an unresolved
  `var()`
- **THEN** the tool SHALL return the expression as written rather than a computed
  number

