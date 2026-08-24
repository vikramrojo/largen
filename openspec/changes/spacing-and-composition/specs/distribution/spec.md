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
