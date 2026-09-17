## MODIFIED Requirements

### Requirement: Browser floor
The library SHALL require Safari 16.2+, Chrome 111+ and Firefox 113+ — the floor
set by `color-mix()`, `@layer`, `revert-layer` and `:where()` — and SHALL NOT
provide a fallback path for those features.

`@property` SHALL be the one exception: the library SHALL ship a compiled
fallback that preserves the slot mechanism in engines that meet the floor but
lack `@property` (Firefox 113–127, including ESR 115, and Safari 16.2–16.3).
The fallback SHALL NOT claim to lower the floor itself: below it, the design
does not degrade, it fails, and the documentation SHALL keep saying so.

#### Scenario: An older browser loads the stylesheet
- **WHEN** a browser lacking `color-mix()` or `revert-layer` loads largen
- **THEN** the library SHALL be documented as unsupported rather than degrade
  silently

#### Scenario: A browser at the floor but without @property loads the stylesheet
- **WHEN** a browser has everything largen needs except `@property`
- **THEN** the fallback SHALL reproduce the registrations' behaviour: an unset
  slot resolves as guaranteed-invalid and a set slot does not cascade onto
  children
- **AND** a component that sets a slot SHALL still win over the fallback

#### Scenario: A conforming browser loads the stylesheet
- **WHEN** a browser that supports `@property` loads largen
- **THEN** the fallback SHALL apply nothing, and the registrations SHALL
  remain the authoritative mechanism
