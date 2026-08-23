## MODIFIED Requirements

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

## ADDED Requirements

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
