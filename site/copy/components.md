# Reference components page prose. Structure lives in skill/scripts/pages.mjs.

## page-desc
{{components}} components, each about six lines. Optional, and copy-in rather
than imported. largen ships an algebra, not a dependency, so take the source
and it is yours to edit.

## intro
There is no button here, and no input, select or table. Those are elements,
and `src/elements.css` already themes them. They answer to `data-tone`,
`data-variant` and `data-size` exactly like everything below. A component
class duplicating them would be a worse copy of something the platform
provides.

Each example below is rendered from a validated spec by the same validator and
renderer the [MCP server](/docs/mcp) uses, so nothing on this page is
something `validate_spec` would reject. Fetch any source with
`get_component_source`, or read [reference.css](/components/reference.css)
whole.

Every component below answers to all four axes, `data-tone`, `data-variant`,
`data-size` and real DOM state, without naming any of them. That is not stated
per component because it does not vary: it is the whole point of the algebra.
Set `data-tone` on any ancestor and everything below re-tones.

Entries marked *fragment* are meant to sit inside a parent; shown alone they
are a piece, not a demonstration.

## using-note
Or copy one component's source and skip the file entirely. That is the
intended path. The set exists to be read and taken from, not depended on.
