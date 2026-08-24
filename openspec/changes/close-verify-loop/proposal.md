# Make `largen verify` answer the question it was being asked

## Why

Every check `largen verify` made read one file. That is enough for the local
mistakes — a missing layer, a colour literal, an unregistered slot — and blind to
the ones that cost the most, which are cross-file:

```
@layer largen.components { .kbd { --weight: 500 } }   ← correct
@layer site.base         { *    { --weight: 300 } }   ← in another file
```

Both files are correct. The element paints `300`. `largen verify` said `ok`.

The `distribution` spec required exactly this: *"`largen verify` SHALL perform
static checks only, and SHALL state that it cannot observe rendering."* That was
right when it was written — nothing could resolve a cascade. It is now the thing
holding the gap open.

**For a person this is a footnote to check in the browser. For an agent it is the
whole thing.** A generate → validate → repair loop terminates when validate says
clean, so a verifier that returns clean on a broken component does not merely fail
to help: it ends the loop with false confidence and hands back something wrong. A
partial verifier is worse than an honest one for the same reason a partial
`--check` is worse than none — it is believed.

The instruments already exist. `resolve_cascade`, `explain_slot`, `emit_probe` and
the differential suite shipped in 0.3.0–0.3.2. Nothing wired them into the command
agents actually run.

## What Changes

- **MODIFIED** `largen verify` resolves the cascade across the caller's files: the
  layer order they achieve, and whether each slot a component sets is the one that
  wins on an element matching its own selector.
- **NEW** `--entry`, and inference of an entry stylesheet when it is unambiguous.
  Which declaration wins depends on load order, and a directory walk does not know
  it. Without an order the checks are reported as NOT RUN with the reason —
  guessing would answer confidently about a cascade the project does not have.
- **MODIFIED** The summary states what was checked and what was not, in place of
  one word covering both.
- **MODIFIED** A file that sets paint slots inside a cascade layer of its own is no
  longer reported as a component that forgot its layer. That heuristic existed
  because nothing could evaluate the real question; the cascade check evaluates it
  now, and a finding a correct repair cannot clear is a loop an agent cannot exit.

## Impact

- Two defects in the shipped tools, both surfaced by turning the check on largen
  itself:
  - `orderFromImports` treated a file as atomic and appended it after its imports.
    A `@layer` statement is one of the few things allowed to *precede* `@import`,
    and it is where a stylesheet declares its layer order — so largen's own order
    resolved wrongly and the check reported it as unachievable.
  - `synthesizePath` read only the first functional pseudo on a compound, so
    `:where(ol, ul):is(.stack, .row)` produced an `<ol>` with no class, which the
    rule does not match.
- `verify` reads every discovered stylesheet for the cascade, minified bundles
  included: a vendored `dist/largen.css` is where the layer order and the paint
  rule come from. Linting still skips them.
- Still not covered: rendering. `largen probe` is that, and the summary says so.
