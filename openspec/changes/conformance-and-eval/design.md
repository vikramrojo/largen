## Context

The input for this change was a research note proposing that a conformance harness
be built from scratch, on the grounds that `largen verify` is static and cannot see
rendering. Checked against the repository, both halves of that premise had moved.

`verify` has resolved the cascade across files since 0.3.3. And the harness exists:
`demo/conformance.html` runs eleven assertions covering the note's F1 (checks 2–4),
F2 (9), F3 (8), and *both* structural checks it proposed adding beyond the
documented four — slot containment is check 6, guaranteed-invalid fallback is checks
1, 10 and 11. The note's other figures were stale in the same direction: ~2,400
tokens is now ~3,940, twenty-three components are thirty-two, four failure modes are
eight, twelve slots are fourteen.

What was missing is that nothing runs any of it, and that the four-axes claim has
never been tested.

## Goals / Non-Goals

**Goals:**

- Every assertion largen has written about itself is executed by something other
  than a person opening a page.
- The claim that a component gets four axes for free is checked rather than stated.
- A deterministic score exists for authored components, usable by an agent loop and
  by a future substrate comparison.
- No new runtime dependency, no API key, no network at score time.

**Non-Goals:**

- A head-to-head against an unconstrained baseline. This change builds the scoring
  layer; running a comparison needs an externally sourced task set and is separate.
- Pixel-fidelity scoring against reference designs. Design2Code-style metrics would
  penalise a bounded algebra by construction — a low score would measure what largen
  refuses to express — and its data is research-use-only under ODC-By, unusable in an
  MIT repository.
- Replacing screenshots. They caught six visibly broken components that twelve static
  checks passed; they stay.

## Decisions

### Run the page rather than port its assertions

The eleven checks are written, reviewed, and are the artifact the documentation
points browsers at. Porting them to Node would create a second copy to keep in step
with the first — the failure this repository has hit four times, most recently when
five shipped files changed under an unmoved version number.

So the runner drives the real page in headless Chrome and reads its result, on the
pattern already working in `site/test/cascade-diff.mjs`. `demo/conformance.html`
gains a hidden machine-readable element, exactly as `genai/probe.js` does, so a
driver needs `--dump-dom` rather than script evaluation.

**Assert the count, not only the outcome.** A page reporting `0 of 0 passed` is
green. `skill/scripts/pages.mjs` already derives the number by matching `check(` in
the source; the runner requires the page to report that many. A harness that
verifies nothing is the specific failure this project keeps finding, and it has
found it in its own probe once already.

### Split the matrix by question, not by cost

The obvious framing is that resolving the cascade is cheap and rendering is
expensive, so do as much statically as possible. That framing is wrong here, and the
reason is a documented property of the resolver:

| Question | Mechanism | Browser |
|---|---|---|
| Does the axis reach the component's slot? | `resolveProperty`, declaration-level | No |
| Does it resolve to a different value? | `--tone` inherits; `color-mix()` must resolve | Yes |

`resolveProperty` deliberately does not substitute `var()` and does not walk
inheritance. It can prove that under `data-variant="solid"` the modifier's `--bg`
outranks the component's; it cannot prove the result is blue. Both are worth
knowing and only one needs an engine.

So `genai/matrix.js` resolves all 7 × 4 × 5 × 2 combinations statically — the
structural claim, in milliseconds, for every component — and a rendered sample
confirms values differ. The full cross-product rendered would be 8,960 states across
thirty-two components; the sample is a deliberate bound and is logged as one, because
a silent cap reads as complete coverage.

### `largen eval` scores, it does not generate

The input note assumed `eval` drives a model and judges output, which puts an API key
and a network call inside a package whose first claim is that it needs no toolchain.
Inverting it removes the dependency entirely: the agent that authored the components
is already present, so `eval` takes directories of finished work and scores them.

Eight of the note's nine metrics need no model, using code that exists — conformance
pass rate, theme-swap survival (`genai/probe.js`), axis coverage (the matrix),
colour-literal and raw-token escape rates (`genai/lint.js`), layer-placement errors
(`checkComponentsApply`), tokens per component, repair iterations. Only *visual defect
rate* wanted a judge, and an agent running the accompanying skill can look at a
screenshot without a key.

This also makes the score honest in a way a judge is not: every metric derives from
the six authoring rules and the eight documented failure modes, so it measures
conformance to a published contract rather than an opinion about quality.

### `conformance` is its own capability

`distribution` owns whether a *consumer's* CSS passes. This is about whether
largen's own guarantees hold in a browser — a different subject with different
failure modes, and one whose requirements should not be read as advice to consumers.
`distribution` gains only a pointer, so its verification requirement stops implying
rendering is unchecked.

## Risks / Trade-offs

- **The runner depends on Chrome.** Every rendered suite here already does, and the
  library's browser floor is explicit. The cost is that conformance cannot run where
  Chrome is absent; the runner should say so rather than skip silently, since a
  suite that quietly passes when it did not run is the failure mode being fixed.
- **The rendered sample is a bound, not coverage.** Chosen states will miss
  interactions elsewhere in the matrix. Mitigated by logging what was sampled and
  what was not, and by the static pass covering all combinations structurally.
- **`eval` measures conformance, not quality.** A component can score perfectly and
  look wrong. That is why screenshots stay, and why the metric is named for what it
  measures.
- **A largen-favouring score proves less than it appears.** Any future comparison
  inherits an asymmetry: a baseline arm benefits from enormous training familiarity
  while largen is near-zero-shot from a contract file. A largen win is therefore
  conservative; a largen loss is confounded and needs a few-shot control before it
  means anything. Stating this belongs with the tool, not only with the eventual
  results.
- **No CI exists.** These runners are scripts someone invokes. Tiering is a
  convention until there is a gate to hang it on.
