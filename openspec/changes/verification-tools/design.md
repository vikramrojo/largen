# Design

## The correction this change rests on

`computed_styles` was deferred with this reasoning: a browser engine on a public
unauthenticated endpoint accepting arbitrary HTML is remote code execution unless
sandboxed. That is still true. What was wrong was the alternative offered —
accept a validated spec instead of markup — because it addressed the wrong half.

| | rendering | arbitrary markup |
|---|---|---|
| the rejected design | server-side | accepted |
| the alternative offered | **server-side** | rejected |
| `emit_probe` | **caller-side** | never seen by the server |
| `explain_slot`, `resolve_cascade` | **none** | takes an ancestor chain, not a document |

Removing the markup removes the use case: every question a migrator has is about
markup that already exists. Removing the rendering removes the vulnerability
class. Both new static tools take an **ancestor chain** — a list of
`{tag, classes, attrs}` — which has no children, no text, no scripts, and nothing
to parse as a document.

## The four-answer resolver

`resolve_cascade` and `explain_slot` match selectors against a *linear* chain.
A chain carries no siblings, no child indices and no interaction state, so these
cannot be decided:

`:hover` · `:focus` · `:focus-visible` · `:active` · `:disabled` · `:checked` ·
`:first-child` · `:last-child` · `:nth-*` · `:only-child` · `:empty` ·
`:first-of-type` · `:last-of-type` · `+` · `~`

This is not a corner case. largen's own stylesheets contain **29 occurrences** of
these — 11 `:hover`, 7 `:last-child`, 4 `:first-child`, 3 `:focus-visible`,
2 `:disabled`, 1 `:last-of-type`, 1 `:focus` — including
`tbody:last-of-type tr:last-child` in `src/elements.css`, which is the rule behind
the table-border bug in the report. A resolver run against largen hits this
immediately.

So a rule has **four** possible outcomes, not three:

1. matches and wins
2. matches and loses — with the reason
3. does not match
4. **undecidable from this chain** — reported with the selector and which
   construct made it undecidable

Outcome 4 must never collapse into outcome 3. A caller reads an omission as
"there is no rule here", and a diagnostic instrument that quietly discards what it
cannot evaluate is worse than one that refuses, because it is consulted precisely
when the caller's own model has already failed and they have no way to check it.
Where the undecidable set is non-empty, the answer points at `emit_probe`.

## Why `emit_probe` is built first

The report ranks `resolve_cascade` first on volume and would build it alone if
only one were possible. Volume is the right measure of value and the wrong measure
of order.

`emit_probe`'s computed-value output is a differential test for the resolver:
resolve statically, run the same case in headless Chrome, compare. Without it the
resolver can only be tested against hand-written expectations — which encode the
same understanding of the cascade that the resolver encodes, so agreement proves
nothing. With it, every claim the resolver makes is checkable against the engine
that decides the real answer.

The ship gate follows from that: **no fixture where the static answer and the
browser disagree without the resolver having said "undecidable".** A resolver that
is wrong and says so is usable. One that is wrong and confident is not.

`explain_slot` sits between them because it needs the same selector matcher on a
much narrower surface. Slots are always plain `--x: value` custom-property
declarations: no shorthands, no longhand expansion, no per-property parsing, and
`inherits: false` on every one, so no inheritance walk. Getting the matcher right
there before `resolve_cascade` generalises it to arbitrary properties means the
hard part is exercised where the failures are cheapest to see.

## What `explain_slot` may and may not assert

The report's example output ends:

```
lands on    user-agent  a { color: -webkit-link }  →  rgb(0,0,238)
```

That line is the most useful in the example and the only part not derivable from
the submitted stylesheets. The user-agent stylesheet is engine-specific and is not
an input. Splitting the output keeps the tool honest:

- **Derived, and certain:** the slot resolves guaranteed-invalid; the paint rule's
  `var(--fg, revert-layer)` therefore fires; the declaration reverts rather than
  inheriting. The warning — *you likely want `--fg: currentColor`* — follows from
  that alone, and is the actionable half.
- **Illustrative, and labelled:** the UA value, from a small table covering the 14
  properties the paint rule touches, tagged with the engine it was taken from.
  A caller who needs the exact answer for their browser gets an `emit_probe`
  instead.

## Scope bounds kept from the report

- No `@media` evaluation. Take a viewport width, or report per-condition.
- No `calc()` reduction. Return the expression as written.
- No inheritance walk. Report `inherits: false` and stop — itself an answer the
  reporter needed twice.

## Where the code lives

`genai/` already holds the shared implementations that both the CLI and the MCP
server import — `lint.js`, `layers.js`, `validate.js` — for the reason `lint.js`
states in its own header: writing a rule twice guarantees the two answers
eventually differ. The same applies here, and the batched-lint defect this change
also fixes is that failure having already happened once.

- `genai/cascade.js` — selector matcher and resolver, shared by both new tools
- `genai/probe.js` — probe document generation
- `site/mcp/tools/index.mjs` — MCP surface
- `skill/scripts/cli.mjs` — CLI surface
