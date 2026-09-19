---
title: Authoring · largen
description: How to write a largen component, the ways it goes wrong, and the MCP server that checks your work.
nav: authoring
route: site/public/docs/authoring.html
---

# Authoring a component

The {{rules}} rules, the {{modes}} ways it goes wrong when you break them, and
the MCP server that checks what you wrote.

## A complete component

::contract example

## The rules

::contract rules

## When it goes wrong

The first one is the one to memorise. It is the only failure in largen that
looks like success.

::contract failures

## Check what you wrote

Locally, `npx largen verify`. Over MCP, `check_component_css`. Both run the
same rules from the same module, so they cannot disagree.

Both are static. They have passed clean on visibly broken components before.
Render the result in a browser, in both themes.

## The MCP server

{{tools}} tools over Streamable HTTP, with no key, no account and no
configuration. Everything served is public documentation or a pure function
over what you send.

```
claude mcp add largen --transport http https://largen.dev/api/mcp
```

Orientation, before you write:

- `get_contract`: the slots, the axes, the layer rule and the failure modes
- `list_components`: every component a spec may name
- `get_component_source`: one reference component's CSS, for copying in

Checks, after you write:

- `validate_spec`: a model-emitted node tree against the allowlist
- `check_component_css`: the lint, same rules as `largen verify`
- `render_spec`: validate, render, and get a preview URL

Diagnostics, when something computes wrong:

- `lookup_property`: is this property a slot, and which
- `resolve_cascade`: which declaration wins on an element, and why, no browser
- `explain_slot`: does the paint rule apply this slot, or does it revert
- `check_layer_order`: where each `@layer` actually sorts across files
- `emit_probe`: a browser harness for what static analysis cannot see
- `get_build`: checksums of the served stylesheets, for drift checks

## Your components, not ours

Every tool that reasons about components takes an optional `components`
manifest, produced by `npx largen manifest src/components.css`. Supply it and
the tools answer in your vocabulary; omit it and they fall back to the
reference set. A malformed manifest is an error, never a silent fallback.

## There is no generate_ui

This is a position, not a gap. You are already a capable model and you know
the application being built; a model on this server would know none of that
and add an API key, a cost and a latency budget to every call. The server
equips you and then checks your work. You do the generating.

## Without MCP

Fetch [/llms-compact.txt](/llms-compact.txt): the whole contract inline,
roughly {{compactTokens}} tokens, enough to author a correct component without
another request.
