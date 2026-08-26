## Why

### Wave 1 — the contract had a *How it fails* and no *How it looks good*

A bake-off ran one brief through one model on largen and on Tailwind. The largen
page passed every check — 0 colour literals, 74/74 declarations reaching paint, 0
axis findings — and looked plain: sections butted together, no elevation anywhere,
and a price suffix unreadable on a toned tier.

Measurement, not impression:

- largen ships tokens for colour, radius, type, weight and elevation, and **none
  for space**. The arm invented six paddings; no two agree.
- `--lift-1` / `--lift-2` appear **nowhere** in `llms-compact.txt`, and **0 of 32**
  reference components use `--shadow`. Elevation exists and is unreachable by
  reading.
- `--bg: linear-gradient(…)` paints nothing, silently.
- The contract's sections are *paint · slots · axes · layers · rules · how it
  fails*. There is a **How it fails** and no **How it looks good**.

A second run with composition guidance added to the prompt — same brief, same
model, nothing else changed — produced rhythm, elevation, a working gradient and
readable toned text. The gap is largely largen's own doing.

### Wave 2 — teaching it was not enough

Wave 1 shipped as 0.4.0 and the bake-off re-ran on it with **no addendum** —
the test wave 1 existed to pass. Conformance came back perfect: 0 colour
literals, 100 declarations checked, 0 cascade findings, 0 axis findings, 0
missing hooks. The page still lost visibly on the hero, flat where the reference
has an ambient radial wash.

Of the five composition topics, **exactly one changed the output, and it is the
only one with a verifier behind it**:

| topic | how it is taught | uses in the arm's CSS |
|---|---|---|
| space / em-rem | prose + measured numbers + the `pad-in-rem` rule | adopted, and reasoned about aloud |
| contrast on tone | prose | 3 |
| gradient | prose + a working snippet | **0** |
| elevation | prose, two token names | **0** |
| restraint | prose | n/a |

A snippet is not the active ingredient; enforcement is. The space rule fired 8
times, the agent stopped, judged them intentional and said so in its report. The
gradient section has a copy-pasteable recipe and produced nothing.

Two further measurements:

- The seven layout utilities get **one line of bare names** in the compact
  contract. The arm used `.row` 5 times and `.stack` once, then hand-wrote
  `display:flex` **10 more times** — 48% of its CSS sits outside the algebra,
  re-implementing what largen already ships.
- Elevation at zero is probably **correct** and is not counted as a failure. The
  reference is a flat dark design with no drop shadows.

## What Changes

### Wave 1 — shipped as 0.4.0

- **NEW** `--space-1` … `--space-24` in `src/tokens.css`, nine steps on a 0.25rem
  base, for the rhythm between things.
- **NEW** A `pad-in-rem` warning in `genai/lint.js`. Padding in `rem` does not
  respond to `data-size`; padding in `em` does. Measured: `0.5em 1em` goes
  7px 14px → 10px 20px across sm→xl, while the same padding from the scale stays
  8px 16px. The type grows, the box does not, and the page looks deliberate.
- **NEW** A `composition` section in the contract, served by
  `get_contract({section: 'composition'})` and carried in full by
  `llms-compact.txt` and `SKILL.md`: the spacing scale and the unit rule,
  elevation with restraint, what a slot cannot express, contrast on toned
  surfaces.
- **NEW** Two failure modes, taking the taxonomy from eight to ten — the vanishing
  gradient, and padding that stops responding to the size axis.
- **MODIFIED** The `llms-compact.txt` budget moves from 16kb to 24kb. The check and
  its warning stay; only the number moves.

### Wave 2 — this wave

- **MODIFIED** The seven layout utilities get documented — what each does and the
  properties it reads. All of it is already written in `src/layout.css` comments;
  the compact contract reduces it to seven words.
- **MODIFIED** The gradient recipe moves out of *What a slot cannot express* into
  a positive topic. Filed under failure, it reads as *avoid gradients* rather than
  *here is how to do depth*.
- **NEW** A `slot-gradient` warning in `genai/lint.js`. The vanishing gradient is
  documented as failure mode #9 and has **zero enforcement** — `lint.js` has seven
  rules and none look at gradients.
- **NEW** Verifiers for the remaining composition claims: section rhythm, and an
  `info` when a rule hand-writes `display:flex` where `.row` or `.cluster` exists.
- **NEW** A short axis topic. `data-tone` 0, `data-size` 0, `var(--scale)` 0 — an
  achromatic design is exactly where a maintainer assumes tone is not for them.
- **NEW** `largen probe --size-axis`. Static analysis structurally cannot tell a
  pattern from a component; the renderer can.

## Capabilities

### New Capabilities

None. This extends what exists rather than adding a subject.

### Modified Capabilities

- `design-tokens`: a spacing scale exists, and which unit belongs where
- `authoring-contract`: the contract teaches composition, not only constraint
- `distribution`: `verify` reports padding that has silently lost the size axis,
  reports a gradient routed through a slot, and defers the size-axis question to
  the renderer that can actually answer it

## Impact

### Wave 1

- **First CSS change since 0.3.0.** The build id moves `b9fc348c` → `5445bbba`,
  so this is not a tooling-only release: vendored copies change and the pinned
  path is new.
- `--space-*` collides with no registered slot, so `design-tokens`' naming
  requirement holds.
- The `authoring-contract` spec requires the compact file's size be **reported**,
  not that it be 16kb, so the budget move needs no delta — but a scenario is added
  recording that raising it is a decision with evidence rather than a convenience.
- **The rule was written against a real defect.** Run 2 of the bake-off used the
  rem scale for `--pad` in 8 places, on advice that came with the scale. The rule
  flags exactly those 8 lines, 0 in run 1, and 0 in largen's own components.

### Wave 2

- **A plausible refinement was tested and rejected.** Narrowing `pad-in-rem` to
  fire only when the same rule also sets `--font-size` does not discriminate:
  measured against both runs it clears all 8 correct rules in run 3 **and** all 8
  offending rules in run 2, `.feature-card` and `.price-tier` included. Those
  components took their font-size from children, so the signal is not in the rule
  body. Static analysis cannot tell a pattern from a component — the distinction is
  whether the element sits under a `data-size` at runtime. This is why the size
  axis moves to the renderer rather than the linter getting cleverer.
- **Shipped code changes again.** `genai/lint.js` and `site/mcp/contract.mjs` are
  both in `files[]`, so the version moves and `largen release` records a new
  digest. `releases --check` will demand it.
- **The compact contract has room.** 18,982 of 24,576 bytes, 5,594 free. The
  utilities block is roughly 500, so the budget raised in wave 1 absorbs wave 2
  without moving again.
