---
title: largen: a CSS scaffold for agents
description: An early experiment: a CSS scaffold minimally designed to guide and lint agents, avoiding class soup and declaration drift. No build step.
route: site/public/index.html
hero: true
---

# An early experiment in setting foundations.

What if a CSS scaffold was minimally designed to guide and lint agents,
avoiding class soup and declaration drift? largen is that experiment:
{{slots}} slots, four axes, one universal paint rule, and the components are
yours to write. Plain CSS, with no build step.

::pills
- [The contract](/docs/contract)
- [Authoring and MCP](/docs/authoring)
- [Playground](/play)

## A scaffold, not a component library

largen ships almost nothing to adopt. It is a scaffold: a universal paint
rule, `@property` slots that stop values cascading where they should not, and
`@layer` rules that make overrides work without `!important` or other dark
magic. On top of that sit semantic attributes such as `data-tone="danger"`,
`data-variant="outline"` and `data-size="sm"`, very few utilities, and a
linter you can reach over MCP. An agent working inside the scaffold produces
uniform styling, with or without a component library, and the linter catches
it when it drifts.

Treat this repo as agent memory for how to do design systems in this style.
You should probably not vendor it. Read it, take the ideas, and point your
agent at the linter.

## A complete component

::contract example

## Slots, the mechanism

Plain CSS decides a colour and applies it in the same rule, so every change
after that needs another rule that knows the component. With {{tones}} tones,
{{variants}} variants and {{sizes}} sizes, that is {{combos}} combinations per
component before hover and dark mode. A slot splits deciding from applying.

```css
.chip { --bg: var(--tone); }                     /* the component fills a blank */
* { background-color: var(--bg, revert-layer); } /* one shared rule applies it  */
[data-variant="outline"] { --bg: transparent; }  /* an axis changes the answer  */
```

The outline rule knows nothing about chips, so it works on every component,
including ones not written yet. The cost of the system drops from axes times
components to axes plus components.

## Four features make it hold

`@property` registers each slot as non-inheriting, so a slot stops at its
element. A card's background stays on the card.

`revert-layer` is the fallback when a slot is unset, so an empty blank leaves
the element as the browser drew it.

`@layer` keeps every largen rule in a named layer, so your page CSS always
beats largen without `!important`.

`color-mix()` derives the soft, ink and line shades from the one tone in
scope, so dark mode needs no per-component rules.

## Every tier is paired with a check

A component that sets a colour literal, reaches past the tone axis, sets an
unregistered slot or forgets its layer fails `largen verify` and
`check_component_css`, and a spec that names an unapproved component fails
`validate_spec`. With one legal way to colour a thing, anything hand-set is
easy for a machine to spot.

The same premise shapes the [MCP server](/docs/authoring): it cannot know
your components, so every tool takes an optional manifest of them and answers
in your vocabulary rather than largen's.

## Start here

::cards
- [The contract](/docs/contract) {{slots}} slots, the axes, the layout utilities and the reference components. What the scaffold guarantees.
- [Authoring](/docs/authoring) {{rules}} rules, the {{modes}} ways a component fails, and the MCP server that checks your work.
- [Migrating](/docs/migrating) A runbook for moving a site off Tailwind, daisyUI, CVA and a component registry.
- [Playground](/play) Render a spec. Share it in a URL with no server involved.

## Use it

```
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/largen@latest/dist/largen.css">

# or pinned. A published version is immutable:
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/largen@{{version}}/dist/largen.css">

# or install it:
npm install largen
```

For agents: [/llms-compact.txt](/llms-compact.txt) carries the whole contract
inline, about {{compactTokens}} tokens.

## Evidence, not a showcase

Two pages that run in your browser and report what they find. Neither is a
gallery. They exist because the claims below them are the ones no static check
can settle.

::cards
- [Conformance](/demo/conformance) The mechanism everything hangs on, `revert-layer` against a guaranteed-invalid slot, and the @property fallback that preserves it in Firefox 113–127 and Safari 16.2–16.3. {{conformance}} checks. Open it in Safari, Firefox and Chrome; nothing static can answer this.
- [The load-bearing tests](/demo/tests) UA defaults survive the universal paint rule, tone inherits, slots do not leak to children, and modifiers outrank components.

## Releases

::releases

Every entry in the log is checked against the bytes that version actually
shipped. [The full log](https://github.com/vikramrojo/largen/blob/main/RELEASES.md)
· [npm](https://www.npmjs.com/package/largen)
