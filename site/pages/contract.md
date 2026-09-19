---
title: The contract · largen
description: The scaffold's guarantees: {{slots}} slots, the four axes, one universal paint rule, the layer rule, the layout utilities and the reference components.
nav: contract
route: site/public/docs/contract.html
---

# The contract

Everything the scaffold guarantees, on one page: {{slots}} slots, one
universal paint rule, four axes, one rule about layers that explains most of
what goes wrong, {{utilities}} layout utilities, and an optional set of
reference components to copy from.

## The model

::contract model

## The slots

::contract slots

## The paint rule

::contract paint

## The axes

Four axes. A component mentions none of them and gets all of them.

::contract axes

## Layer order

::contract layers

## Layout utilities

::contract utilities

## Reference components

{{components}} optional components, each about six lines. Copy-in rather than
imported: largen ships a scaffold, not a dependency, so take the source and it
is yours to edit.

There is no button here, and no input, select or table. Those are elements,
and `src/elements.css` already themes them. They answer to `data-tone`,
`data-variant` and `data-size` exactly like everything below. A component
class duplicating them would be a worse copy of something the platform
provides.

Each example below is rendered from a validated spec by the same validator and
renderer the [MCP server](/docs/authoring) uses, so nothing on this page is
something `validate_spec` would reject. Fetch any source with
`get_component_source`, or read [reference.css](/components/reference.css)
whole. Entries marked *fragment* are meant to sit inside a parent; shown alone
they are a piece, not a demonstration.

::components

## Using them

```
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/largen@latest/dist/largen.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/largen@latest/dist/largen.components.css">
```

Or copy one component's source and skip the file entirely. That is the
intended path. The set exists to be read and taken from, not depended on.
