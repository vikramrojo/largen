## Context

largen's contract acquired a `composition` section in wave 1 because the algebra
was teaching rules and not craft — there was a *How it fails* and no *How it looks
good*. Wave 1 shipped a spacing scale, a `pad-in-rem` warning and five composition
topics, and 0.4.0 went out.

The bake-off then re-ran on the shipped contract with **no addendum**, which is the
test wave 1 existed to pass. It passed on every number and lost on the page: 0
colour literals, 100 declarations checked, 0 cascade findings, 0 axis findings, 0
missing hooks, and a flat hero against a reference with an ambient radial wash.

Reading the arm's stylesheet against what the contract told it gives a single,
uncomfortable pattern. Of five composition topics, one changed the output — the one
with a lint rule behind it. Two topics with prose alone produced nothing, and the
gradient topic produced nothing **despite having a working, copy-pasteable
snippet**. Whatever makes guidance land, a code sample is not it.

The constraint this design works under: the compact contract is a budget, not a
wiki. It sits at 18,982 of 24,576 bytes. Everything below has to earn its bytes.

## Goals / Non-Goals

**Goals:**

- Every claim the `composition` section makes should be able to fail, so it
  participates in the generate → validate → repair loop rather than sitting beside
  it.
- Close the largest measured documentation hole: seven layout utilities described
  by seven words.
- Put the size-axis question where it can actually be answered.
- Keep the compact contract inside the budget raised in wave 1, without raising it
  again.

**Non-Goals:**

- Making `pad-in-rem` smarter. This was attempted and disproved — see Decisions.
- Treating elevation-at-zero as a defect. The reference is a flat dark design;
  zero drop shadows is the correct answer and chasing it would be optimising
  toward a target that does not exist.
- Declaring a bake-off winner. The asymmetry that forbids it is unchanged.
- Adding a runtime dependency. The renderer work reuses `buildProbe` and headless
  Chrome, both already present.

## Decisions

### Enforcement is the active ingredient, so each topic gets a verifier

The evidence is a natural experiment inside one run: same section, same agent, same
model. `space` had prose, measured numbers **and** a lint rule, and was adopted with
the agent explicitly reasoning about the em/rem split in its report. `gradient` had
prose and a working snippet and no rule, and produced zero. `elevation` had prose
and produced zero.

*Alternative considered:* write better prose. Rejected — the gradient topic is
already the best-written of the five and has the only complete code sample. If
prose quality were the lever, it would be the one that landed.

### The gradient moves out of the failure section

It currently sits under **"What a slot cannot express"**, inside a section about
things that go wrong. That framing tells a reader gradients are a hazard; the
recipe underneath is read as a workaround for a hazard rather than an instruction.
Lifting it into a positive topic costs nothing and is the cheapest hypothesis to
test, since the `slot-gradient` rule ships alongside it and the bake-off measures
`background-image` count directly.

*Risk of confounding:* the reframe and the lint rule land together, so a positive
result cannot attribute itself to one or the other. Accepted deliberately — both
are cheap, both are wanted, and separating them costs a whole extra bake-off run to
answer a question that does not change what ships.

### The size axis moves to the renderer, and the linter stays dumb on purpose

The obvious narrowing for `pad-in-rem` — warn only when the same rule also sets
`--font-size`, on the reasoning that `--scale` multiplies font-size and padding
with nothing to scale against is fine in rem — **was implemented against both runs
and rejected**:

```
run 3 (correct)   8 rules set --pad in rem   all 8 would clear
run 2 (the bug)   8 rules set --pad in rem   all 8 would clear
                                             ← .feature-card, .price-tier included
```

Run 2's offending components inherited their font-size from children, so the signal
is not in the rule body. The real distinction — pattern or component — is *whether
the element sits under a `data-size` at runtime*, which is not a fact a stylesheet
contains. This is the argument the eval notes make about static analysis generally,
arriving in a specific case.

So: `pad-in-rem` stays a warning and stays a heuristic, with its `why` honest about
being one, and the authoritative check moves to a browser.

*Alternatives considered:* (a) downgrade to `info` — rejected, it fires on a real
defect and severity should track the defect, not the false-positive rate; (b) drop
it once the probe exists — rejected, the probe needs a rendered page and the linter
runs on a stylesheet, so they answer at different moments and the cheap one is
worth keeping.

### The size-axis probe uses the side-by-side fixture, not `steps`

`buildProbe` supports `steps` including `{set, attr, value}`, so driving
`data-size` between measurements is possible. It is also unnecessary: the pattern
already in `site/test/size-axis.mjs` puts the same markup twice in one document,
once under `data-size="sm"` and once under `"xl"`, and measures both in a single
pass. That needs no probe change, no second render, and no ordering assumptions
about when a step settles.

### The utilities block is transcription, not authorship

`src/layout.css` already documents each utility and the properties it reads —
`--gap`, `--measure`, `--min-item`, `--threshold`, `--side`, `--min-content`. The
compact contract simply never carried it. That the utilities are themselves
configured by custom properties is *the same story the rest of the contract tells*,
and omitting it makes them look like ordinary class names worth ignoring, which is
how the arm treated them.

## Risks / Trade-offs

**The bake-off cannot isolate five simultaneous changes** → The three predictions
are chosen to be individually attributable: hand-written `display:flex` count maps
to the utilities block, `background-image` count maps to the gradient work, and
plain-property share maps to both. A null result on one does not muddy the others.

**One run is one sample** → A single agent on a single brief is an anecdote about a
population of one. Stated in the summary already; the numbers are directional, and
the harness is cheap enough to re-run if a result looks like noise.

**New lint rules add false positives to a loop that must be able to exit** →
`slot-gradient` is a warning, not an error, and the flex `info` is the lowest
severity available. A finding a correct choice cannot clear is a loop that cannot
terminate, which is why wave 1 chose `warning` for `pad-in-rem` and why that choice
now looks right rather than lucky.

**The budget could still be exceeded** → 5,594 bytes free against roughly 500 spent.
`largen contract --check` fails on a forgotten regeneration and warns past the
limit, so this cannot ship silently oversized.

**Renaming the change can drop scenarios silently** → The scenario-drop detector
compares by requirement name, so a renamed requirement passes while losing its
scenarios. The rename here is of the *change directory*, not of any requirement, so
the blind spot is not triggered — but the wave-2 deltas add requirements rather
than renaming existing ones, deliberately.

## Migration Plan

No consumer migration. `--space-*`, the slots and the layer order are untouched;
this wave adds documentation and checks. Shipped code changes, so the version moves
and `largen release` freezes a new digest — a rollback is pinning the prior
version, which the release log already makes possible.

## Open Questions

- Should the flex `info` name the specific utility it would have used (`.row` vs
  `.cluster`), or only that one exists? Naming it is more useful and more likely to
  be wrong.
- If the bake-off shows the utilities block working and the gradient work not, is
  the next move a stronger gradient verifier or a worked example in the reference
  components? The second is a bigger change and would want its own evidence.
