# Design

## Context

This document explains how largen works. The specs next to it say *what* must be
true; this says *why it is built this way*, and is the thing to read first.

largen is a CSS library with an unusual shape. It ships almost no components. What
it ships is the machinery that makes a component cheap to write — so that a
project writes its own dozen, in its own vocabulary, instead of adopting someone
else's sixty.

### The three tiers

```
                                                  SIZE      WHO WRITES IT
  ┌──────────────────────────────────────────────────────────────────────┐
  │ TOKENS    --canvas --ink --surface --line          ~0.5kb   theme    │
  │           --primary/--primary-on …                          author   │
  ├──────────────────────────────────────────────────────────────────────┤
  │ SLOTS     --bg --fg --pad --gap --radius … (12)   ~0.25kb   LIBRARY  │
  ├──────────────────────────────────────────────────────────────────────┤
  │ AXES      tone · variant · size · state            ~0.6kb   LIBRARY  │
  ├──────────────────────────────────────────────────────────────────────┤
  │ PAINT     one universal rule                      ~0.15kb   LIBRARY  │
  └──────────────────────────────────────────────────────────────────────┘
       "mostly primitives" — a fixed cost that does not grow

  ┌──────────────────────────────────────────────────────────────────────┐
  │ UTILITIES stack row cluster center grid switcher sidebar     LIBRARY │
  └──────────────────────────────────────────────────────────────────────┘
       "a handful" — layout only

  ┌──────────────────────────────────────────────────────────────────────┐
  │ COMPONENTS  .entry-card  .callout  .toc-link  …  ~6 lines each        │
  │             derived from a reference component, or original           │
  │                                              YOU or THE AGENT         │
  └──────────────────────────────────────────────────────────────────────┘
       the only tier that scales
```

Everything above the last box is roughly 2.3kb gzipped and stays that size no
matter how many components a project defines.

## Goals / Non-Goals

**Goals**

- A component costs about six lines, and gets colour, size, state and theming for
  free.
- No build step. Link the CSS and it works.
- Replace Tailwind and daisyUI on a real site, not in a toy.
- Be legible to an agent: a small, closed vocabulary with mechanical rules.

**Non-Goals**

- A component catalog. The reference components are examples, not an API.
- Behaviour. Focus trapping, popovers, virtual scrolling — that is the
  platform's job or radix's. largen styles `<dialog>` and `<details>`; it does
  not reimplement them.
- Graceful degradation. The browser floor is a hard floor.
- An atomic utility layer. Rebuilding a miniature Tailwind is the layer this
  project argues is convenience without insight.

## Decisions

### 1. One generic slot instead of a private slot per component

daisyUI's `--badge-color` / `--btn-color` / `--alert-color` prevent one
component's colour leaking into another by *namespacing* — 61 prefixes, and
therefore 61 copies of every variant rule.

largen uses one set of generic slots (`--bg`, `--fg`, `--pad`…) and buys the same
protection once, with `@property { inherits: false }`. A card's `--bg` cannot
reach a badge inside it because the property does not inherit, not because the
name is unique.

That is the whole trade, and it is what collapses 61 rules into one.

**Alternative considered:** prefixed slots (`--c-bg`). Safer against third-party
CSS, two characters heavier per line, and it keeps layout-utility knobs and
component slots as two separate concepts. Rejected for terseness — with largen
replacing Tailwind wholesale, the collision surface is small.

### 2. The universal paint rule — why there is no build step

Everything is painted by one rule:

```css
@layer largen.paint {
  * {
    background-color: var(--bg, revert-layer);
    padding: var(--pad, revert-layer);
    font-size: var(--font-size, revert-layer);
    /* …9 more… */
  }
}
```

Applying anything to `*` looks reckless. `padding: 0` on every element would
destroy every `<ul>` indent and every `<button>`; `font-size: 1rem` would flatten
every heading.

It doesn't, because of how the slots are registered:

```css
@property --pad { syntax: "*"; inherits: false; }   /* NO initial-value */
```

With universal syntax and **no `initial-value`**, an unset slot holds the
*guaranteed-invalid* value. `var()` then falls back, and the fallback is
`revert-layer` — which rolls the property back to the previous cascade layer, or
where there is none, to the UA stylesheet. So the rule is **inert until a
component opts in**. Verified: `<h1>` keeps its size, `<ul>` its indent,
`<button>` and `<td>` their padding.

This is the load-bearing mechanism of the entire library. Two consequences follow
from it and are worth stating in the same breath:

- **Never give a slot an `initial-value`.** It would then never be unset, the
  fallback would never fire, and the universal rule would strip UA defaults from
  every element on the page. `largen verify` checks this.
- **`paint.css` must stay inside a layer.** `revert-layer` from an unlayered rule
  is meaningless. Also checked.

**Why this matters more than it sounds:** because paint reaches every element,
nothing has to *declare* itself a component. No marker attribute, no registration,
no generated selector list — and therefore no build step. An earlier prototype
required one marker attribute per element (91 of them on a single page) and a
generator to collect them. Both were solving a problem this rule dissolves.

**Alternative considered:** a marker attribute (`data-largen`) plus a build step
that scans component CSS and generates the paint selector list. Works, adds a
mandatory compile, and puts a marker on nearly every element. Rejected once the
universal rule was shown to be non-destructive.

### 3. Tone inherits; variant does not

`--tone` is an ordinary inherited custom property, so `<section data-tone="danger">`
re-tones every component inside it with no per-child markup. The derived values
(`--tone-soft`, `--tone-ink`, `--tone-line`) are computed by a formula written
exactly once.

Variant is different. With a universal paint rule there is no marker separating a
component from a bare `<span>`, so a subtree variant selector
(`[data-variant="solid"] *`) would paint every wrapper element on the page. Variant
therefore applies only to the element carrying it.

This is a real capability loss versus the marker-based prototype, taken knowingly:
tone inheritance is the valuable half and it survives intact.

### 4. Size is one inherited number

`data-size` sets `--scale`, which inherits. A component multiplies by it where it
sets type, and expresses padding and gap in `em` — so spacing follows type for
free. No component ever writes a size variant, and a container at
`data-size="sm"` shrinks everything inside it.

### 5. State comes from the DOM

`:disabled`, `:user-invalid`, `:read-only`, `:focus-visible`. The browser already
tracks these; mirroring them into a `data-state` attribute would be exactly the
hand-transcription this design deletes.

One trap encoded here: `:read-only` matches *any* non-editable element per spec,
including every checkbox, radio, range and file input. Unqualified, it greys them
all. The rule is therefore restricted to genuinely editable fields.

### 6. Layer order

```
reset < tokens < paint < tone < elements < components < modifiers
```

`elements` before `components` so a component class beats a bare-element default.
`modifiers` last so an explicitly requested variant beats a component's default
fill.

Everything is layered and `:where()`-wrapped, so consumer CSS always wins without
`!important` — there is none anywhere in the library.

### 7. Layout utilities, not atomic utilities

Seven, each configured by custom properties: `stack`, `row`, `cluster`, `center`,
`grid`, `switcher`, `sidebar`. Because `--gap` is a slot, the universal paint rule
applies it — so a layout utility *is* a component, one that happens to set only
layout slots. One concept, not two.

Responsiveness is intrinsic. `switcher` reproduces `flex-col sm:flex-row` using
`flex-basis: calc((var(--min-item) - 100%) * 999)`, which reflows on **container**
width with no media query. `sidebar` does the same for a two-column layout. That
is why largen needs no `sm:`/`xl:` variant system to replace Tailwind's.

### 8. Components are addressed by class or custom element

`.entry-card` and `<entry-card>` both work, because paint is universal and
nothing needs registering. Use custom elements for containers that would
otherwise be `<div>`/`<span>`; keep real elements where semantics matter — `<a>`,
`<nav>`, `<details>`, `<ol>` carry meaning a custom element would discard.

### 9. Two agent audiences, kept separate

```
  BUILD-TIME AGENT  authors CSS components  →  skill/SKILL.md
  RUN-TIME AGENT    emits UI from allowlist →  genai/manifest.json + validate.js
```

They need different things. The skill teaches the slot vocabulary and the layer
rule so an agent writes a correct component first time. The genai layer constrains
a model to an allowlist at render time; it has no field for a colour, class or
handler, so its safety property is structural rather than defensive.

## Risks / Trade-offs

**Every element resolves 12 declarations.** → The main cost of going universal.
Acceptable on ordinary pages; if it bites on a very large DOM, the escape hatch is
scoping the rule to `[data-largen] *` with one attribute on `<html>`.

**Slots are unprefixed globals.** → Any third-party CSS setting `--bg` or `--pad`
on an element repaints it. Small surface when largen replaces Tailwind wholesale;
the mitigation if not is the same scoping attribute.

**The core mechanism is confirmed on three engines — at current versions.** →
`@property` with universal syntax and omitted `initial-value` is spec-mandated
behaviour (CSS Properties and Values API L1), and `demo/conformance.html` now
asserts it from `getComputedStyle` instead of by eye. It reports 9/9 in Blink,
Gecko and WebKit:

| engine | version confirmed |
|---|---|
| WebKit | Safari 26.5.2 (macOS 26.5.2) |
| Gecko  | Firefox 154.0 |
| Blink  | Chrome 151.0.7922.173 |

Be precise about what that does and does not establish. Those three versions were
executed. The `Safari 16.4+ / Chrome 111+ / Firefox 128+` floor in the README is
*inferred* from published support data for the four features the design needs —
`@property`, `revert-layer`, `@layer` and `color-mix()` — and those builds were
not run. The residual risk is no longer "does WebKit do this at all", which is
answered; it is "did any shipped version between the floor and today get it
wrong", which is unanswered and would need a device lab to close.

There is still no fallback path, so a regression here is fatal rather than
degrading. `demo/conformance.html` is the tripwire.

**No build step means no dead-code elimination.** → A project importing the
reference components ships all of them. Mitigation: don't import them; copy the
two you want.

**Variant does not cascade to a subtree.** → Accepted (Decision 3). Tone does,
and tone is the valuable half.

**Static verification cannot see rendering.** → A previous prototype passed every
static check while six components were visibly broken: `:empty` hiding three of
them, a checkbox rotated into a diamond, `:read-only` greying every checkbox and
range. Screenshot review is part of verification, not an optional extra.

## Open Questions

- Whether the 16.4 / 128 version floors hold on the actual floor builds. Current
  Safari, Firefox and Chrome are confirmed by execution; the floors are inferred
  from support data and would need a device lab to verify.
- Whether `sites/rojos/` belongs in this repo long-term or moves into the site.
