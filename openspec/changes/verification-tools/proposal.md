# Answer "which rule decided this?" without a browser

## Why

The same migration that produced the last eleven recommendations reported back
after using the tools they asked for. The authoring gap closed — `lookup_property`
would have prevented the leading trap outright, `check_layer_order` resolves in
one call what cost two debugging rounds. The **verification** gap did not, and
that is where the time went.

They sorted roughly twenty uses of a hand-built iframe + `getComputedStyle`
harness by the question being asked:

| Question | Uses | Needs a browser? |
|---|---:|---|
| Which declaration wins for property P on element E, and why? | ~13 | **No** |
| Did this change alter rendering anywhere? | ~3 | No |
| Does this behave correctly through an interaction? | ~4 | Yes |

**Two thirds was cascade arithmetic, not rendering.** A browser was reached for
because it was the only oracle available. All four of their worst bugs —
`--weight: 900` computing as `300`, a badge sitting 2px low, links surviving
`--fg: inherit` only by accident, table rules changing colour — are answerable
from stylesheets, layer order and an ancestor chain. No pixels required.

**This corrects a decision recorded in the last change.** `computed_styles` was
deferred on the grounds that a browser engine on a public unauthenticated
endpoint accepting arbitrary HTML is remote code execution unless sandboxed. That
objection stands, but it applies to exactly one design. The alternative offered —
`computed_styles({ css, spec, … })`, taking a validated spec instead of markup —
kept the *rendering* and dropped the *markup*, when the fix is the reverse.
Dropping the rendering removes the RCE class outright. Dropping the markup
removes the use case, because every question a migrator has is about markup that
already exists.

Three designs follow, none of which runs an engine on the server.

## What Changes

- **NEW** `emit_probe` returns a self-contained HTML harness the caller runs
  against their own build. No engine server-side, no untrusted input, nothing to
  sandbox — largen never executes anything. It is the only one of these that
  reaches the behavioural cases, where a static answer and a screenshot are
  equally worthless.
- **NEW** `explain_slot` answers the specifically-largen question for one slot on
  one element: does the paint rule apply it, or does it revert, and what does it
  revert to?
- **NEW** `resolve_cascade` generalises `check_layer_order` from layers down to
  declarations — every matching declaration in cascade order, the winner, and the
  reason. Roughly 65% of the reporter's harness use.
- **MODIFIED** `check_component_css` classifies each file in the batch form before
  linting it. Passing a components directory that contained one theme produced 130
  findings, every token flagged as a colour literal in an undeclared component.
  `largen verify` has always skipped non-component files; the batch form did not.
- **MODIFIED** `check_layer_order` accepts an `entry` and derives load order from
  its `@import` graph instead of trusting the order it was handed — the one place
  its answer could be silently wrong, as its own header admitted.

## Build order, and why it is not the reported ranking

The report ranks `resolve_cascade` first on volume and would build it alone if
only one were possible. Build order here is **`emit_probe` → `explain_slot` →
`resolve_cascade`**, for a reason the report does not raise.

A cascade resolver is consulted exactly when the caller's own mental model has
already failed. They have no independent check on its answer, so a confidently
wrong `resolve_cascade` is worse than no tool: it would have "explained" the
`--weight` bug with a wrong reason and cost more than the afternoon it saved.

`emit_probe` is the fixture that makes the resolver checkable. Its computed-value
output is precisely a differential test: resolve statically, run the probe in
headless Chrome, compare. Building the oracle emitter first is not a concession on
ambition; it is the precondition for building the resolver responsibly.
`explain_slot` sits between them because it exercises the selector matcher on the
narrowest surface — slots are always plain `--x: value` custom-property
declarations, with no shorthands and no longhand expansion — before
`resolve_cascade` generalises the same matcher to arbitrary properties.

## Not in scope

- **`diff_stylesheets`** (T4) — deferred, not rejected.
- **`check_upgrade`** (T5) — deferred, and it has a prerequisite the report does
  not name: it needs a machine-readable list of behavioural deltas keyed by build
  id. `build.json` carries build ids but no changelog, so T5 is "write and
  maintain a delta manifest" before it is a tool.
- **A hosted rendering endpoint** — the objection stands, and `emit_probe` makes
  it unnecessary.
