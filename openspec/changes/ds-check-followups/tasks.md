# Tasks

## 1. Part 1 — coined-tag check as a warning (0.6.1)

- [ ] 1.1 Add the coined-tag classifier to `genai/lint.js`: a conservative
      leading-token list (`button`, `nav`, `dialog`, `input`, `select`,
      `form`, `menu`, `a`, `label`) matched against coined element names in
      component selectors and manifest `element` fields, severity from a
      single exported constant set to `warning`. Verify with new unit cases
      in the lint's test coverage: `button-primary` warns naming `<button>`,
      `notification` stays silent.
- [ ] 1.2 Confirm both surfaces report it with no second implementation:
      `npx largen verify` on a fixture stylesheet and an MCP
      `check_component_css` call return the same finding text. Verify via
      `site/test/run.mjs` gaining an assertion for the finding on both paths.
- [ ] 1.2a Add the structural dark-rule check to `genai/lint.js` (error): any
      `prefers-color-scheme` media query or theme-selector-scoped rule in a
      stylesheet classified as a component, values irrelevant. Verify with
      the evasion case from the findings:
      `@media (prefers-color-scheme: dark) { .plan-capacity { --bg: var(--surface); } }`
      errors with zero literals present, and a theme file setting tokens
      under `[data-theme="dark"]` stays silent.
- [ ] 1.2b Add the structural size-variant check to `genai/lint.js` (error):
      a size-axis-suffixed modifier or `data-size`-scoped rule that re-sets
      scale slots (`--pad`, `--font-size`, `--gap`). Verify:
      `.plan-capacity--lg { --pad: var(--pad-5); --font-size: var(--text-lg); }`
      errors; `.plan-capacity--empty` setting non-scale slots stays silent;
      both surfaces (`largen verify`, `check_component_css`) return the same
      finding via a `site/test/run.mjs` assertion.
- [ ] 1.3 Add the coined-tag rule, the reference-tier guidance, and the
      density/RTL out-of-scope statement to the structured contract source
      with explanatory text; regenerate surfaces (`npx largen gen`). Verify
      the three statements appear in `llms-compact.txt` and SKILL.md, and
      that no surface was hand-edited (regeneration is idempotent).

## 2. Part 1 — MCP argument validation and evals (deploy-only)

- [ ] 2.1 Measure what the SDK already rejects: script a wrong-typed, an
      out-of-enum, and a missing-required call against a local server; record
      the results in the task commit message. Verify: the script exists under
      `site/test/` and its output distinguishes SDK-rejected from
      passed-through.
- [ ] 2.2 Close the measured gap in `guard()` with a schema-driven validator
      reading each tool's declared `inputSchema` (type, enum, required,
      array-item shape). Verify: the 2.1 script now shows every malformed
      call returning an error result naming the argument; `site/test/run.mjs`
      passes.
- [ ] 2.3 Build the outcome-eval harness `site/test/evals.mjs`: scenarios
      seeded from the contract's failure modes (unlayered component, sublayer
      parenting, `--fg: inherit`, theme outranking), each scoring whether the
      tools' answers name the documented cause. Verify: `node
      site/test/evals.mjs` runs green in CI beside the existing suite.

## 3. Release 0.6.1

- [ ] 3.1 Run `npx largen build` and confirm the build id is unchanged (no
      CSS change shipped); update RELEASES.md with the 0.6.1 entry following
      the house format. Verify: release check passes; RELEASES.md states "no
      CSS change" with the current build id.
- [ ] 3.2 Publish 0.6.1 to npm and deploy the site (MCP validation and evals
      go live). Verify: `curl https://largen.exe.xyz/health` reports 0.6.1,
      and both CDNs resolve `largen@0.6.1`.

## 4. Part 2 — DTCG export (superseded)

Superseded by the `dtcg-token-layer` change (export via `largen build`, import via `largen theme`, drift guard in `largen verify`).

## 5. Part 2 — lint promotion and release 0.7.0

- [ ] 5.1 Flip the severity constant to `error`; update the 1.1/1.2 test
      expectations. Verify: `npx largen verify` on the 1.2 fixture now fails,
      and `check_component_css` reports `error` severity.
- [ ] 5.2 Add the MIGRATING.md entry for the promotion (what now fails, the
      two spellings that fix it). Verify: entry present and named from the
      RELEASES.md 0.7.0 entry.
- [ ] 5.3 Build, confirm the build id is still unchanged, write the 0.7.0
      RELEASES.md entry, publish, deploy. Verify: `/health` reports 0.7.0;
      `npx largen@0.7.0 verify` reports the coined-tag check at error severity from a
      clean install.

## 6. Verification

- [ ] 6.1 Run the full suite (`site/test/run.mjs`, discovery, conformance,
      evals) against the deployed 0.7.0 and check every scenario in this
      change's three spec deltas against observed behaviour. Verify: all
      green; any deviation is fixed or the spec delta corrected before
      archive.
