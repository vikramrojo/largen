# MCP page prose. Structure lives in skill/scripts/pages.mjs; the tool
# descriptions are keyed tool-<name> and the page fails to generate if a tool
# the server exposes has no description here, or a description here names a
# tool the server no longer exposes.

## page-desc
{{tools}} tools, over Streamable HTTP, with no authentication. Everything here
is public documentation or a pure function over what you send.

## connect-note
No key, no account, no configuration.

## tool-get_contract
The slots, the axes and their permitted values, the layer rule, the authoring
rules and the known failure modes. Takes an optional `section`. Call it before
authoring a component.

## tool-list_components
Every component a spec may name, with descriptions, elements, slots and
permitted children.

## tool-get_component_source
The CSS of one reference component, for copying in. Names are resolved against
a known list and never against a path.

## tool-validate_spec
Checks a model-emitted node tree against the allowlist. Rejects unknown
components and axis values, and rejects `style`, `onclick`, `className` or
`dangerouslySetInnerHTML` rather than dropping them. A model emitting one of
those is a signal worth surfacing.

## tool-check_component_css
Lints CSS you just wrote: layer membership, colour literals, reaching past the
tone axis, unregistered slots. This tool has no equivalent elsewhere, because
elsewhere the components are fixed. Here you write them, so the most useful
thing a server can do is tell you whether what you wrote is correct.

## tool-render_spec
Validates, renders, and returns the HTML inline plus a preview URL. Takes
`theme` and `css`, so your own components appear as they do in your project.

## tool-lookup_property
Answers whether a CSS property is driven by a slot, and which. Derived from
the paint rule, so it follows the library rather than a list kept beside it.

## tool-check_layer_order
Resolves where each `@layer` actually sorts across your stylesheets and
reports where that differs from the order declared. Catches the cross-file
failures a single-file linter cannot see.

## tool-resolve_cascade
Given stylesheets and an element's ancestor chain, returns every matching
declaration of a property in cascade order, the winner, and which cascade step
decided it. No browser involved. Rules it cannot decide from a chain are
reported, never dropped.

## tool-explain_slot
For one slot on one element: is it set, and does the paint rule paint it, or
does it revert to the user-agent stylesheet? Catches `--fg: inherit`, which
reads as "use the surrounding colour" and does the opposite.

## tool-emit_probe
Returns a self-contained HTML harness you run against your own build, for the
questions static analysis cannot reach. The server generates the file and
never executes anything.

## tool-get_build
Version, build id, and per-file sha256 and integrity strings for the served
stylesheets. Use it to check a vendored copy for drift.

## yours-not-ours
largen's premise is that you write your own components, so a server holding a
catalog could only ever describe largen's reference set, which is useless in
the project you are actually working in. Instead every tool takes an optional
`components` manifest.

## yours-not-ours-note
Pass that object as `components` and the tools answer in your vocabulary. Omit
it and they fall back to the reference set. A malformed manifest is an error,
never a silent fallback. Answering confidently in the wrong vocabulary is
worse than refusing.

## no-generate-ui
This is a position, not a gap.

A `generate_ui` tool takes natural language and returns a UI spec, which
requires a model on the server. You are already a capable model, and you know
the application being built, its data and its conventions. A model here would
know none of that, and would add an API key, a cost and a latency budget to
every call in exchange for a worse answer.

So this server equips you with `get_contract`, `list_components` and
`get_component_source`, and then checks your work with `validate_spec`,
`check_component_css` and `render_spec`. You do the generating.

## without-mcp
Fetch [/llms-compact.txt](/llms-compact.txt): the whole contract inline,
roughly {{compactTokens}} tokens, enough to author a correct component without
another request.
