# Spec Delta

## ADDED Requirements

### Requirement: The contract states the coined-tag rule
The contract SHALL state that a coined element name is for containers with no
interactive or landmark role, and that a pattern with such a role is authored
as a class on the native element that carries it. It SHALL name the failure the
rule prevents: a coined tag renders styled and inert, with no role, no
accessible name, and no keyboard behaviour.

#### Scenario: An agent consults the contract before coining a tag
- **WHEN** the contract is read from any generated surface
- **THEN** it SHALL state when a coined tag is permitted and what to use
  instead when it is not

### Requirement: The contract addresses outgrowing two token tiers
The contract SHALL say what to do when a project outgrows the two-tier token
model — when one brand must produce several themes and values repeat across
them: the project introduces its own reference-value layer (a palette its
themes assign from), and the themes keep setting largen's semantic tokens only.
The contract SHALL state that largen itself ships no reference tier.

#### Scenario: A project scales one brand across several themes
- **WHEN** an author asks the contract how to avoid repeating raw values
  across themes
- **THEN** the contract SHALL describe the project-owned reference layer and
  SHALL NOT suggest components or themes reach past semantic tokens

### Requirement: The contract declares context axes out of scope
The contract SHALL state that density, writing direction and form-factor
contexts are not axes, and SHALL name the escape hatch: media and container
queries inside a component are allowed and normal.

#### Scenario: An author looks for a density axis
- **WHEN** the contract is consulted for a compact or dense mode
- **THEN** it SHALL state that no such axis exists, that this is deliberate,
  and that the component expresses the adaptation itself with a media or
  container query
