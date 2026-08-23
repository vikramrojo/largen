## ADDED Requirements

### Requirement: The contract names the idiom for un-styling
The contract SHALL document how to return a slot to the guaranteed-invalid value,
because that is the only way to make largen stop styling something it has claimed.

#### Scenario: A project needs largen to release a property
- **WHEN** an author needs an element to keep its user-agent value for a property
  largen is painting
- **THEN** the contract SHALL state that setting the slot to `initial` returns it
  to guaranteed-invalid, so the fallback fires

#### Scenario: largen is adopted incrementally
- **WHEN** largen runs alongside another framework during a migration
- **THEN** the contract SHALL present this as the mechanism that makes
  coexistence possible, not as an aside

### Requirement: The contract gives the recipe for inheriting text colour
The contract SHALL state how a component keeps the colour of its surroundings,
and SHALL name the spelling that looks correct and is not.

#### Scenario: A link should take the surrounding colour
- **WHEN** an author needs a link to inherit the colour around it rather than the
  tone the element layer applies
- **THEN** the contract SHALL give a working recipe

#### Scenario: The obvious spelling is tried
- **WHEN** an author sets the foreground slot to `inherit`
- **THEN** the contract SHALL warn that this returns the slot to
  guaranteed-invalid and yields the user-agent link colour, not the surrounding
  colour
- **AND** SHALL explain why, since the mechanism is correct and only the outcome
  is surprising

### Requirement: The contract says when an axis does not apply
The contract SHALL state that the variant axis is optional.

#### Scenario: A component's variants are not derived from a tone
- **WHEN** a project's variants are a surface treatment rather than a tone
- **THEN** the contract SHALL say to write classes instead
- **AND** SHALL NOT present the four variants as universal

#### Scenario: An author fights the axis
- **WHEN** routing a non-tonal variant through the axis tints borders and labels
  in ways the design did not ask for
- **THEN** this SHALL be documented as the axis not applying, rather than as
  something to work around

### Requirement: The contract addresses the fixed-size control
The contract SHALL say what to do when a component must change its box without
changing its type, which the size axis alone does not express.

#### Scenario: A control shrinks its box but holds its type
- **WHEN** a design calls for a smaller control at an unchanged font size
- **THEN** the contract SHALL give the approach that achieves it
- **AND** SHALL relate it to the rule against per-component size variants, rather
  than leaving the two in apparent conflict
