# Spec Delta

## ADDED Requirements

### Requirement: DTCG export
The library SHALL provide a command (`largen tokens --dtcg`) that exports the
token set as W3C Design Tokens Community Group format JSON, derived from the
token source rather than maintained beside it. Given a theme, the export SHALL
reflect that theme's values. The output format is a promised surface: a change
to its shape SHALL be treated with the same release discipline as a change to
the stylesheet.

#### Scenario: The token set is exported
- **WHEN** `largen tokens --dtcg` runs against the library
- **THEN** it SHALL emit DTCG JSON in which every token carries a `$value` and
  a `$type`, and colour tokens are typed as colours

#### Scenario: A theme is exported
- **WHEN** the command is given a theme stylesheet
- **THEN** the emitted values SHALL be the theme's values for every token the
  theme sets, and the library defaults for the rest

#### Scenario: A token is added to the source
- **WHEN** a token is added to the token source
- **THEN** it SHALL appear in the export with no edit to an export-side list,
  because the export derives from the source

#### Scenario: A consumer pins the format
- **WHEN** a downstream pipeline (Style Dictionary, a Figma sync) consumes the
  export
- **THEN** a later largen release SHALL NOT change the shape of the emitted
  JSON within a patch release
