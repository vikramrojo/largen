## MODIFIED Requirements

### Requirement: The contract states the failure modes
The contract SHALL describe how the system fails, not only how it is used.

#### Scenario: An agent finds that a variant has no effect
- **WHEN** an agent consults the contract after `data-variant` fails to apply
- **THEN** the contract SHALL direct it to check that the component is declared
  inside `@layer largen.components`
- **AND** SHALL explain that tone and size keep working in that case, which is
  why the failure is easy to miss

#### Scenario: A consumer writes a preflight layer statement
- **WHEN** the contract shows a preflight `@layer` statement that orders the
  library's layers against the consumer's own
- **THEN** the statement SHALL list every library sublayer, with `fallback`
  first
- **AND** SHALL explain that a sublayer omitted from the preflight is created
  when the library loads and appended after the ones listed — and that for
  `fallback` this puts the per-element resets above the components layer in
  exactly the engines the fallback exists for, while looking correct in every
  engine a developer is likely to test in
