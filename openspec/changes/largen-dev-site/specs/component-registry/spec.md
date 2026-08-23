## ADDED Requirements

### Requirement: Manifest generation from a project's CSS
The tooling SHALL generate a component manifest by reading a project's component
CSS, so the manifest is not maintained by hand.

#### Scenario: A project adds a component
- **WHEN** a new component is added to the project's CSS and the manifest is
  regenerated
- **THEN** the component SHALL appear in the manifest
- **AND** SHALL become nameable in a validated spec

#### Scenario: A component is removed
- **WHEN** a component is deleted from the CSS and the manifest is regenerated
- **THEN** it SHALL no longer appear, and specs naming it SHALL fail validation

### Requirement: Component detection
A component SHALL be identified as a rule that is a single compound selector and
declares at least one registered slot.

#### Scenario: A descendant rule is encountered
- **WHEN** a rule uses a combinator, such as `.callout > summary`
- **THEN** it SHALL NOT be reported as a component

#### Scenario: A layout-only helper is encountered
- **WHEN** a rule sets no registered slot
- **THEN** it SHALL NOT be reported as a component

#### Scenario: A state or attribute variation is encountered
- **WHEN** rules such as `.nav-link:hover` and `.nav-link[aria-current]` appear
  alongside `.nav-link`
- **THEN** the component SHALL be reported once

### Requirement: Descriptions come from an annotation
A component's description SHALL be read from an annotation immediately preceding
its rule.

#### Scenario: An annotated component is generated
- **WHEN** a component is preceded by `/** @largen … */`
- **THEN** the annotation text SHALL become the component's description in the
  manifest

#### Scenario: An unannotated component is generated
- **WHEN** a component has no annotation
- **THEN** it SHALL still appear in the manifest, with no description
- **AND** the omission SHALL be reported, since an undescribed component is
  harder for a model to use correctly

### Requirement: Reference component source is retrievable
The source CSS of each reference component SHALL be retrievable individually, for
copying into a project.

#### Scenario: A project wants one reference component
- **WHEN** a project needs a single reference component
- **THEN** its CSS SHALL be retrievable without importing the whole reference set

#### Scenario: A name is supplied from an untrusted caller
- **WHEN** a component name arrives over the network
- **THEN** it SHALL be resolved against the known component list
- **AND** SHALL NOT be interpolated into a filesystem path
