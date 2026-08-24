## Why

`demo/conformance.html` runs eleven assertions about the one mechanism largen has
no fallback for, computes pass/fail, and **nothing executes it**. `largen verify`
asserts the file exists; `shots.mjs` photographs it. Its checks run only when a
human opens the page — which is the "render the demo pages in a browser" advice
that is a footnote for a person and a false stop condition for an agent looping
generate → validate → repair.

Separately, largen's central claim is that a component gets seven tones, four
variants, five sizes and two themes for free. Nothing proves it, and the claim is
the reason to choose largen over a component catalogue.

## What Changes

- **NEW** A conformance runner drives `demo/conformance.html` in a headless
  browser and fails the build on any failed assertion — and on a page that reports
  fewer checks than its source contains, because `0 of 0 passed` is green.
- **MODIFIED** `demo/conformance.html` publishes its results as machine-readable
  text alongside the table, so a driver that can only read the DOM can consume them.
- **NEW** An axis matrix over the 7 × 4 × 5 × 2 combinations, resolved statically,
  asserting every reference component responds to all four axes. A rendered sample
  confirms the values actually differ, which static resolution cannot show.
- **NEW** `largen eval` — a deterministic score over two directories of authored
  components. No model, no API key, no network: the agent that authored them is the
  one already in the room, and every metric but one is computable from code that
  exists.
- **MODIFIED** `shots.mjs` stops screenshotting `/demo/`, which was removed and now
  404s, and checks that each path resolves before shooting it.

## Capabilities

### New Capabilities

- `conformance`: executing largen's own guarantees in a browser rather than
  publishing a page that asserts them, and proving that all four axes reach every
  reference component
- `substrate-eval`: scoring authored components against the contract
  deterministically, so a claim about reliability can be measured rather than
  asserted

### Modified Capabilities

- `distribution`: the verification requirement states what `verify` covers and
  directs the reader elsewhere for rendering; it should name the tier that now runs
  rather than implying rendering is unchecked

## Impact

- **New:** `site/test/conformance.mjs`, `genai/matrix.js`, `skill/scripts/eval.mjs`
- **Modified:** `demo/conformance.html`, `site/test/shots.mjs`, `skill/scripts/cli.mjs`,
  `site/mcp/contract.mjs`
- **Reused rather than rebuilt:** `resolveProperty` and `synthesizePath`
  (`genai/cascade.js`), `buildProbe` (`genai/probe.js`), `lintComponentCss`
  (`genai/lint.js`), the headless-Chrome pattern in `site/test/cascade-diff.mjs`.
- **No new dependency.** `eval` scores files; it does not call a model. That keeps
  the published package free of an API key in a project whose first claim is that it
  needs no toolchain.
- Shipped files change, so the version moves and `largen release` records a new
  digest — the check added in 0.3.3 enforces this.
- **Not in scope:** a head-to-head against an unconstrained baseline. `eval` provides
  the scoring layer that such a comparison would need; running one requires a task
  set sourced outside the project to avoid maintainer bias, and that is its own work.
