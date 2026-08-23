# agent-authoring Specification

## Purpose
TBD - created by archiving change build-largen. Update Purpose after archive.
## Requirements
### Requirement: A build-time agent interface
The repository SHALL provide a skill that teaches an agent to author components
correctly, covering the tier model, the slot vocabulary, the axis values, and the
layer rule.

#### Scenario: An agent is asked to add a component
- **WHEN** an agent has the skill available
- **THEN** it SHALL have the slot names, the axis values, and the requirement to
  declare inside `@layer largen.components` without reading the library source

### Requirement: The skill documents failure modes, not just usage
The skill SHALL describe the diagnostic for a variant that does not apply.

#### Scenario: A variant appears to do nothing
- **WHEN** `data-variant` has no effect on a component
- **THEN** the skill SHALL direct the reader to check that the component is
  declared inside the components layer

### Requirement: The skill is discoverable
The skill SHALL live at `skill/` and SHALL be reachable from `.claude/skills/`.

#### Scenario: A tool enumerates available skills
- **WHEN** a tool scans `.claude/skills/`
- **THEN** the largen skill SHALL be found

### Requirement: Build-time and run-time interfaces are separate
The skill SHALL serve agents authoring CSS; the generative-UI artifacts SHALL
serve agents emitting UI. They SHALL NOT be merged.

#### Scenario: An agent renders UI at run time
- **WHEN** a model emits a UI description
- **THEN** it SHALL be constrained by the generative-UI allowlist, not by the
  skill

