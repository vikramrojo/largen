## MODIFIED Requirements

### Requirement: Token names cannot collide with slots
Token names SHALL be distinguishable from slot names, so that setting one is
never mistaken for setting the other.

Where a token supplies the document-wide default for a property that also has a
slot, the two SHALL be named as a pair: the token carrying a `-base` suffix and
the slot carrying the property's name.

#### Scenario: A token is named
- **WHEN** a token is added
- **THEN** its name SHALL NOT match any registered slot

#### Scenario: A property has both a document default and a per-component slot
- **WHEN** a property such as font-size or line-height has both
- **THEN** the token SHALL be the slot's name with `-base` appended
- **AND** the relationship SHALL be evident from the names alone

#### Scenario: A document default is set on the root
- **WHEN** the reset applies a base token to the document
- **THEN** it SHALL use a value that inherits, so descendants recompute it
- **AND** SHALL NOT use a slot, because a slot does not inherit and descendants
  would revert to the user-agent value instead

#### Scenario: A token is added
- **WHEN** a token is introduced with the same name as a slot
- **THEN** it SHALL be renamed, because the slot would be shadowed and the
  universal paint rule would read the token
