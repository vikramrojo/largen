## Why

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

## What Changes

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

## Capabilities

### New Capabilities

None. This extends what exists rather than adding a subject.

### Modified Capabilities

- `design-tokens`: a spacing scale exists, and which unit belongs where
- `authoring-contract`: the contract teaches composition, not only constraint
- `distribution`: `verify` reports padding that has silently lost the size axis

## Impact

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
