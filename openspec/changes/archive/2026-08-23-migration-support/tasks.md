## 1. Two more slots — delivered ahead of this proposal

Shipped in `cbfabdb`, recorded here because the deltas describe it.

- [x] 1.1 Register `--line-height` and `--letter-spacing`, `inherits: false`, no `initial-value`
- [x] 1.2 Paint both with a `revert-layer` fallback — fourteen properties
- [x] 1.3 Rename the `--leading` token to `--line-height-base`, beside `--text-base`
- [x] 1.4 Move the five existing plain `letter-spacing` declarations onto the slot
- [x] 1.5 Verify inheritance survives on the real build, not only in simulation
- [x] 1.6 Conformance 9/9 against source, bundle and the deployed stylesheet
- [x] 1.7 Measure the added paint cost — unmeasurable at 1,609 elements
- [x] 1.8 Derive the slot count everywhere it was spelled as a word, and in the test that asserted twelve

## 2. Contract material

- [x] 2.1 The `initial` idiom for returning a slot to guaranteed-invalid — presented as what makes incremental adoption possible, not as an aside
- [x] 2.2 The link recipe: `--fg: currentColor`, **with `--fg: inherit` named as the trap** and why it yields the user-agent link colour
- [x] 2.3 The variant axis is optional — if your variants are a surface treatment rather than a tone, write classes
- [x] 2.4 Rule 4 gains a caveat, not an exception: `em` couples padding to type, `rem` decouples it, so a fixed-size control is a unit choice rather than a size variant
- [x] 2.5 Verify each recipe in a browser before writing it down — 2.2 exists because the reported one does not work
- [x] 2.6 `largen contract --check`, then confirm the new material reaches `SKILL.md`, `llms-compact.txt` and `get_contract` over MCP

## 3. The utility mapping table

- [x] 3.1 Spacing, flex and type utilities only, as equivalences rather than advice
- [x] 3.2 State the boundary in the table's own header, so the absence of components reads as a position
- [x] 3.3 Spot-check a sample against a browser rather than trusting the arithmetic — a wrong table is worse than none
- [x] 3.4 Screenshot the guide in both themes; it is long and the tables are where generated prose breaks

## 4. MCP: the cheap four

- [x] 4.1 `check_component_css` accepts an array, returning findings per stylesheet, with the single-string form still working
- [x] 4.2 Property-to-slot lookup, deriving its answers from the registrations so a new slot needs no edit
- [x] 4.3 `get_contract` carries the build identifier
- [x] 4.4 Expose the served checksums, so a vendored copy can be checked without hashing by hand
- [x] 4.5 Confirm the array form on a real project's worth of files, and that per-file attribution is right — the point is fewer calls, not a merged blob

## 5. MCP: the layer check

- [x] 5.1 Resolve layer order from a set of stylesheets and their `@layer` statements — first mention wins, and a sublayer takes its parent's position
- [x] 5.2 Report where the resolved order differs from the declared order, naming the layer and the reason
- [x] 5.3 Reproduce both bugs from the report as fixtures: sublayers straddling a third layer, and a framework base sorting after largen
- [x] 5.4 Confirm it passes on an order that is actually achievable — a check that only ever fails is not a check
- [x] 5.5 Confirm it would have caught the `--weight: 900` computing as `300` case, which is the one whose symptom points elsewhere

## 6. Verification

- [x] 6.1 `largen verify`, conformance 9/9 against source and bundle
- [x] 6.2 Full suite locally and against the deployed site
- [x] 6.3 Screenshot every page in both themes and read them
- [x] 6.4 `openspec validate migration-support`
