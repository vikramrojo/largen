## ADDED Requirements

### Requirement: Verification reports padding that has lost the size axis
`largen verify` SHALL report a component whose `--pad` is written in an absolute
unit, because such padding does not respond to `data-size`.

#### Scenario: A component sets --pad from the spacing scale
- **WHEN** a component sets `--pad` in `rem`, including via a spacing token
- **THEN** it SHALL be reported, naming what happens: the type resizes with the
  size axis and the box does not

#### Scenario: A component sets --pad in em
- **WHEN** a component sets `--pad` in `em`
- **THEN** nothing SHALL be reported, because that padding follows the size axis

#### Scenario: A pattern sets --gap from the spacing scale
- **WHEN** `--gap` is set from a spacing token
- **THEN** nothing SHALL be reported, because rhythm between things is legitimately
  absolute and is what the scale is for

#### Scenario: The fixed padding is deliberate
- **WHEN** an author intends padding that does not resize
- **THEN** the report SHALL be a warning rather than an error, since a finding that
  a correct choice cannot clear is a loop that cannot exit

### Requirement: Verification reports a gradient routed through a slot
A gradient assigned to a paint slot SHALL be reported. `--bg` drives
`background-color`, so a gradient given to it paints nothing and does so silently.

#### Scenario: A component sets --bg to a gradient
- **WHEN** a component sets `--bg` to a `linear-gradient`, `radial-gradient` or
  `conic-gradient`
- **THEN** verification SHALL report it
- **AND** the report SHALL name the write-the-slot-then-the-plain-property pattern
  that achieves the intended result

#### Scenario: The gradient is written beside the slot
- **WHEN** a component sets `--bg` to a token and writes `background-image`
  separately
- **THEN** nothing SHALL be reported, because the element stays inside the algebra
  and the gradient reaches the page

#### Scenario: A documented failure mode has no check
- **WHEN** a failure mode is recorded in the taxonomy
- **THEN** it SHOULD have a corresponding check, since guidance that cannot fail
  does not participate in a generate-validate-repair loop

### Requirement: The size axis is answered by the renderer
Whether padding responds to `data-size` SHALL be verifiable by rendering, because
static analysis cannot determine it.

#### Scenario: A candidate is checked for size-axis response
- **WHEN** a rendered check is run against a candidate
- **THEN** it SHALL render the same markup under two `data-size` values and report
  which padded elements did not change
- **AND** the result SHALL distinguish an element that is deliberately fixed from
  one whose padding was expected to scale, which the static rule cannot

#### Scenario: The static rule and the rendered check disagree
- **WHEN** the static warning fires on padding the rendered check finds correct
- **THEN** the rendered result SHALL be authoritative
- **AND** the static rule SHALL remain a warning, described as a heuristic, since
  it runs on a stylesheet where no rendered answer is available
