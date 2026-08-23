# Close the gaps a real migration found

## Why

A migration of a live Astro + Tailwind site onto largen produced eleven
recommendations, ordered by how much time each one cost. They are the first
evidence largen has from someone who is not its author, and they fall into three
kinds.

**Things the contract knows and does not say.** The `initial` idiom for returning
a slot to guaranteed-invalid is the only way to make largen stop styling
something it has claimed, and it is what made nine commits of running alongside
Tailwind possible at all. It was derived from the `@property` spec, not from our
documentation. The same is true of how a link keeps its surrounding colour, and
of when the variant axis simply does not apply.

**Things the tooling could catch and does not.** `check_component_css` takes one
string, so linting eleven files takes eleven calls; the reporter made 34 and
about 27 were that. More seriously, both of their worst bugs were cross-file
layer-order problems that a linter reading one file structurally cannot see —
and the symptom of one was `--weight: 900` computing as `300`, which does not
look like a layer problem to anyone who is not already suspicious.

**One thing that is a genuine gap in the algebra**, already fixed: `line-height`
and `letter-spacing` were not slots, so a component that changed its font size
had nowhere to say what leading it wanted. That work shipped ahead of this
proposal and is recorded here as delivered.

## What Changes

- **BREAKING** `--leading` becomes `--line-height-base`, freeing the slot-shaped
  name for the slot. Nothing outside frozen release artifacts referenced it.
- **NEW** `--line-height` and `--letter-spacing` slots. Twelve becomes fourteen.
- **NEW** Contract material for the `initial` idiom, the link recipe, and the
  optionality of the variant axis.
- **NEW** A bounded utility-mapping table in the migration guide, covering
  spacing, flex and type — and explicitly not components.
- **MODIFIED** `check_component_css` accepts several stylesheets at once.
- **NEW** A cross-file layer-order check, which is the only kind of tool that
  could have caught the two most expensive bugs in the report.
- **NEW** A property-to-slot lookup, so "is `line-height` a slot?" is a question
  with an answer rather than a thing you find out by being wrong four times.
- **MODIFIED** `get_contract` reports the build it was generated from.

## Capabilities

### Modified Capabilities

- `style-algebra` — two more slots; the paint rule covers fourteen properties
- `design-tokens` — the base-value naming pattern made explicit, so a token and
  its slot are recognisably a pair
- `authoring-contract` — the idioms above, and the axis optionality
- `documentation-site` — the utility mapping table
- `agent-mcp` — batching, the layer check, the property lookup, build identity

### Deferred

- `computed_styles`, the tool the reporter calls the single most useful possible
  addition. It is deferred rather than dropped: see `design.md`, which reaches a
  decision about the shape rather than assuming one, because the obvious shape
  is remote code execution on a public endpoint.

## Impact

- Renaming `--leading` is breaking for any theme that set it. One vendored
  consumer exists and does not.
- Fourteen slots changes a number that appeared as a word in six places. Those
  now derive from the `@property` registrations, so the next slot costs nothing.
- `check_component_css` gains an array form; the single-string form keeps
  working, because the MCP server has consumers and one of them is a migration
  in progress.
