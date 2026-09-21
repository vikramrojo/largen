# Spec Delta

## ADDED Requirements

### Requirement: The vocabulary is enumerable and typed
The set of tokens a theme may set SHALL be declared in one machine-readable
vocabulary that names every token, its DTCG type, the group it belongs to, and
its structural rules: which tokens pair with an on-colour, which are aliases,
and which are constrained to a unit. The vocabulary SHALL match
`src/tokens.css` exactly, and the library's own verification SHALL fail by
name when the two disagree in either direction.

#### Scenario: A theme tool asks what it may set
- **WHEN** a consumer reads the vocabulary
- **THEN** it SHALL find every themeable token with a type, and no slot,
  derived tone or per-component property among them

#### Scenario: Space is constrained to rem
- **WHEN** the vocabulary is read for a `space` token
- **THEN** it SHALL declare the unit constraint, so a tool can reject a pixel
  value before it becomes a theme

#### Scenario: A token is added to the CSS
- **WHEN** a token is added to `src/tokens.css` without a vocabulary entry
- **THEN** verification SHALL fail and name the token, rather than let the
  export silently omit it

## MODIFIED Requirements

### Requirement: Theme contract
A theme SHALL set tokens only. It SHALL NOT reference a component, a slot, or a
variant. A theme that sets a semantic tone SHALL set both the tone and its
on-colour.

#### Scenario: The theme is switched to dark
- **WHEN** `data-theme="dark"` is set on the document
- **THEN** every component, variant and size SHALL follow from the token
  overrides alone
- **AND** no per-component dark rule SHALL exist anywhere in the library

#### Scenario: A component appears wrong only in dark mode
- **WHEN** a component requires its own dark-mode rule to look correct
- **THEN** this SHALL be treated as a defect in the algebra, not fixed in the
  component

#### Scenario: A theme sets half a tone
- **WHEN** a theme sets `--primary` and not `--primary-on`
- **THEN** it SHALL be treated as an invalid theme, because the solid variant
  would paint the default contrast against a new tone
- **AND** a theme generated from a token document SHALL be rejected before it
  is written
