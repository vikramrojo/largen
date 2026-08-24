# Tasks

## 1. The scale

- [x] 1.1 `--space-1` … `--space-24` in `src/tokens.css`, nine steps on 0.25rem.
      Run 2 of the bake-off chose this granularity unprompted, which is reasonable
      evidence it is the right one.
- [x] 1.2 Comment records the unit decision and the measured numbers behind it.
- [x] 1.3 Confirm no collision with any registered slot.

## 2. The rule

- [x] 2.1 `pad-in-rem` in `genai/lint.js`, following the existing
      `add(rule, severity, line, message, why)` shape.
- [x] 2.2 Warning, not error — fixed padding is sometimes deliberate.
- [x] 2.3 `--pad` only. `--gap` is legitimately absolute and is what the scale is for.
- [x] 2.4 Validated against the real defect: 8 warnings on bake-off run 2, which
      used the rem scale for `--pad` in 8 places; 0 on run 1; 0 on largen itself.

## 3. Composition in the contract

- [x] 3.1 `COMPOSITION` in `site/mcp/contract.mjs` — space and the unit rule,
      elevation with restraint, what a slot cannot express, contrast on toned
      surfaces, and what "loud is relative" means.
- [x] 3.2 Registered in `SECTIONS` so `get_contract({section:'composition'})` serves it.
- [x] 3.3 Rendered in full into `SKILL.md` and `llms-compact.txt`. Full, not a
      pointer: the measured improvement was of the material being in the prompt.
- [x] 3.4 `llms.txt` links it.

## 4. Two more failure modes

- [x] 4.1 A gradient set through `--bg` paints nothing, silently.
- [x] 4.2 Padding in rem stops responding to `data-size`.
- [x] 4.3 Taxonomy goes from eight to ten; both were found by measurement this week.

## 5. The budget

- [x] 5.1 16kb → 24kb in `skill/scripts/contract.mjs`.
- [x] 5.2 The comment records the evidence: composition guidance is ~4kb, there were
      463 bytes of headroom, and the material demonstrably changed the output.
- [x] 5.3 The check and its warning stay. Proved it still fires by temporarily
      lowering the limit to 8kb.

## 6. Verify

- [x] 6.1 `site/test/size-axis.mjs` — the measurement as a test: type resizes, em
      padding follows, rem padding does not, and the rule fires on exactly the
      right cases.
- [x] 6.2 **It passed for the wrong reason first.** rem padding read `0px at every
      size` because `dist/largen.css` had not been rebuilt, so `var(--space-2)`
      resolved to nothing. Rebuilt; it now reads the real `8px 16px`. A test whose
      number is the argument has to be read, not just watched go green.
- [x] 6.3 Full suite: 78 MCP, 17 discovery, 11 cascade-diff, 9 probe-theme,
      9 verify-cascade, 15 matrix, 11 conformance, 4 size-axis.
- [x] 6.4 `contract --check` current; budget under 24kb at 18.09kb.
- [x] 6.5 Bump, freeze, deploy. First CSS change since 0.3.0 — build id moves
      `b9fc348c` → `5445bbba`.
- [ ] 6.6 Re-run the bake-off with the shipped contract and NO addendum. If the
      composition section works, run 3 should approach run 2 using only what largen
      ships. This is the real test of the change.

## Recorded, not acted on

`var(--scale)` is consumed 18 times in the reference components and 0 times in
`src/layout.css` and `src/elements.css`. The size axis spans ±25% and ~20 of 32
components abstain from it entirely. That is a real observation about one of four
headline axes, and it is what made this design one scale rather than two: patterns
never see `--scale`, so pattern spacing has no reason to be relative.

Whether a type-only multiplier that most components ignore has earned its place
beside tone and variant is a larger question than a spacing scale, and is not
settled here.
