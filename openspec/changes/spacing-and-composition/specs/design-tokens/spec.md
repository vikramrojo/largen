## ADDED Requirements

### Requirement: A spacing scale exists, and the unit carries meaning
largen SHALL ship a scale of spacing tokens for the rhythm between things, and the
contract SHALL state which unit belongs where.

#### Scenario: A page needs rhythm between sections
- **WHEN** an author needs space between sections, or page-level padding
- **THEN** a scale SHALL be available rather than each value being invented
- **AND** its tokens SHALL be absolute, because the space between two sections
  should not change when a component inside one carries a size

#### Scenario: A component sets its own padding
- **WHEN** a component sets `--pad`
- **THEN** the contract SHALL direct it to `em`, because a component multiplies its
  `--font-size` by `--scale` and `em` padding follows that font-size
- **AND** SHALL state what happens if it does not: the type resizes and the box
  does not

#### Scenario: A spacing token is added
- **WHEN** a spacing token is added
- **THEN** its name SHALL NOT match any registered slot, as for every other token
