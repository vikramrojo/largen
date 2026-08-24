# authoring-contract Specification

## Purpose
TBD - created by archiving change largen-dev-site. Update Purpose after archive.
## Requirements
### Requirement: A single structured source for the contract
The authoring contract SHALL be defined in exactly one structured source, and
every surface that presents it SHALL be generated from that source.

#### Scenario: The contract changes
- **WHEN** an axis value, a slot, or an authoring rule changes in the source
- **THEN** the skill file, `llms.txt`, `llms-compact.txt` and the `get_contract`
  tool SHALL all reflect the change after regeneration
- **AND** no surface SHALL require a separate manual edit

#### Scenario: A generated surface is edited by hand
- **WHEN** a generated surface is edited directly
- **THEN** the next regeneration SHALL overwrite it, and the edit SHALL be
  treated as a defect

### Requirement: The contract carries prose, not only enumerations
The contract source SHALL include explanatory text for each rule, so generated
surfaces can explain rather than only list.

#### Scenario: The skill file is regenerated
- **WHEN** `skill/SKILL.md` is generated from the source
- **THEN** it SHALL retain guidance explaining why each rule exists
- **AND** SHALL NOT be reduced to tables of names and values

### Requirement: The contract states the failure modes
The contract SHALL describe how the system fails, not only how it is used.

#### Scenario: An agent finds that a variant has no effect
- **WHEN** an agent consults the contract after `data-variant` fails to apply
- **THEN** the contract SHALL direct it to check that the component is declared
  inside `@layer largen.components`
- **AND** SHALL explain that tone and size keep working in that case, which is
  why the failure is easy to miss

### Requirement: The compact contract fits in a prompt
`llms-compact.txt` SHALL contain the entire contract inline, and its size SHALL
be reported when it is generated.

#### Scenario: The contract grows
- **WHEN** the compact file exceeds a size that fits comfortably in a prompt
- **THEN** this SHALL be treated as evidence that the contract has grown beyond
  what the design claims, and reported rather than silently accepted

### Requirement: The contract prints the mechanism, not only its description
The contract SHALL reproduce the universal paint rule and the slot registrations
verbatim from the library source, so a reader never has to reconstruct them.

#### Scenario: A reader wants the paint rule
- **WHEN** a reader consults the contract for the universal paint rule
- **THEN** the rule SHALL be shown as it is written in the source, including which
  property each slot drives
- **AND** it SHALL NOT be described only in prose

#### Scenario: A reader wants the slot registrations
- **WHEN** a reader consults the contract for how the slots are registered
- **THEN** the `@property` declarations SHALL be shown as written

#### Scenario: The source changes
- **WHEN** the paint rule or a registration changes in the library
- **THEN** the printed text SHALL follow after regeneration, with no separate edit

#### Scenario: A reader reconstructs the mechanism from the contract alone
- **WHEN** a reader builds a mental model from the contract without reading the source
- **THEN** the model SHALL be correct in the details that matter — which properties are
  driven, which selector the rule uses, and which custom properties are registered

### Requirement: Inheritance is reported by mechanism, not as one list
The contract SHALL distinguish custom properties registered as inheriting from those
that inherit merely because they were never registered.

#### Scenario: An agent asks what inherits
- **WHEN** an agent consults the contract about inheritance
- **THEN** registered inheriting properties SHALL be reported separately from
  unregistered ones
- **AND** the difference SHALL be explained, since only a registered property is
  type-checked and animatable

#### Scenario: The two are presented as one list
- **WHEN** a single list mixes both kinds
- **THEN** this SHALL be treated as a defect, because a reader will conclude the
  unregistered ones carry guarantees they do not have

### Requirement: The contract states its own exceptions
Where a rule does not hold universally, the contract SHALL name the exception and its
reason.

#### Scenario: The initial-value prohibition is consulted
- **WHEN** a reader consults the rule forbidding `initial-value` on a slot
- **THEN** the contract SHALL note the one registered property that carries an initial
  value
- **AND** SHALL explain that it is a multiplier rather than a paint slot, so it must
  always resolve

#### Scenario: A claim is made about every selector
- **WHEN** the contract describes how consumer CSS wins
- **THEN** it SHALL be accurate about which selectors are zero-specificity by wrapping
  and which are so inherently

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

### Requirement: A file layered under its own name is not a mislayered component
The contract SHALL distinguish a component that omitted its cascade layer from a
stylesheet that deliberately declares in a layer of its own.

#### Scenario: A framework default sets a paint slot in its own layer
- **WHEN** a stylesheet sets registered slots inside a cascade layer that is not
  `largen.components`
- **THEN** it SHALL be treated as framework, library or system CSS
- **AND** SHALL NOT be reported as a component that forgot its layer, since it did
  not forget one

#### Scenario: A component sets slots outside any layer
- **WHEN** a stylesheet sets registered slots and opens no cascade layer at all
- **THEN** it SHALL be reported, because unlayered CSS outranks `largen.modifiers`
  and `data-variant` silently stops applying

#### Scenario: The layer a component chose turns out to lose
- **WHEN** a component is layered, but its declaration does not win
- **THEN** that SHALL be reported by resolving the cascade rather than by inferring
  it from the layer's name

