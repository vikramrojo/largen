# Design

## Context

See proposal.md for motivation. Constraints that shape the approach:

- The repo's one-parser discipline: `genai/lint.js` is the single lint
  implementation behind both `largen verify` and the MCP's
  `check_component_css`; a second copy of any rule is how the two surfaces
  came to disagree once already.
- The npm package ships `src`, `genai`, `skill/scripts`, `dist` — not `site/`.
  MCP server changes are deploys; only what lands in `genai/` or
  `skill/scripts` is release surface.
- Zero dependencies everywhere. Any schema validation or token parsing is
  hand-rolled over structures the repo already owns.
- The release convention (RELEASES.md): patches never move the build id;
  minors mark new promised surface. Nothing in this change touches
  `src/*.css`, so the build id stays put across both parts.

## Goals / Non-Goals

**Goals:**
- One coined-tag rule, implemented once, surfaced by both lint surfaces, with
  severity staged warning (0.6.1) → error (0.7.0).
- MCP tool calls that fail loudly on out-of-schema arguments, enforced from
  the same `inputSchema` objects the tools already declare.
- Contract additions generated from the single contract source, never written
  into a surface by hand.

**Non-Goals:**
- No new axes (density/RTL are being declared out of scope, not designed).
- No retrieval/knowledge tool on the MCP (the Southleft server's territory;
  the complement argument is in the findings doc).
- No change to the stylesheet or the slot vocabulary.

## Decisions

**1. Coined-tag detection lives in `genai/lint.js` as a classifier over
selectors and manifest entries.** A conservative allowlist of role-implying
leading tokens (`button`, `nav`, `dialog`, `input`, `select`, `form`, `menu`,
`a`, `label`) is matched against coined element names in component selectors
and against a manifest component's `element`. Alternative considered: a full
ARIA-role inference table — rejected as false-positive-prone; the warning
naming the native element is the value, and a short list covers the real
mistakes.

**2. Severity is a constant in `lint.js`, flipped in the 0.7.0 commit.**
Alternative: key severity off `package.json` version at runtime — rejected;
the published version *is* the release line, so a constant changed in the
release commit is the same information without a runtime version parse that
could disagree with the packaging.

**2b. Dark-rule and size-variant checks are structural, not value-based, and
error from day one.** The existing colour-literal rule looks at values, which
is exactly how a token-valued dark block slips through. These two checks look
at structure instead: any `prefers-color-scheme` media query or
theme-selector-scoped rule inside a stylesheet classified as a component; any
size-axis-suffixed modifier or `data-size`-scoped rule re-setting scale slots.
The existing `classifySheet` step already separates themes from components, so
a theme setting tokens under `[data-theme="dark"]` is never in scope — the
false-positive risk that would otherwise force warning-first staging. Severity
differs from the coined-tag check deliberately: coined-tag is a new rule
(warning until 0.7.0), these enforce SHALL NOTs the contract has carried since
`component-authoring` was written, so a flagged component was always
non-conformant and the fix is a linter defect correction (the 0.3.4
precedent). Alternative considered: warning-first for symmetry — rejected;
staging an enforcement of an existing rule re-opens the gap the bake-off
measured, that guidance without a check does not change agent output.

**3. MCP argument enforcement goes in `guard()`, driven by the declared
`inputSchema`.** First task is to *measure* what the SDK already rejects
(the probe finding was on the comparison server, not ours). Whatever gap
remains is closed by a small validator (~60 lines: type, enum, required,
array-item shape) that reads the same `inputSchema` object registered with the
SDK — one schema, two consumers, no duplication. Alternative: per-tool
hand-written checks (the current partial state) — rejected as the thing that
drifts.

**4. Outcome evals are a `site/test/` harness seeded from the contract's
failure modes.** Each eval is a scenario (broken stylesheet or spec, the
documented fix) plus a scripted tool-call sequence asserting the tools' answers
point at the fix. Scoring is substance ("does the answer name sublayer
parenting"), not shape. Deploy-only; runs in CI beside the existing suite.

**5. DTCG export.** Superseded by the `dtcg-token-layer` change, which
declares a vocabulary table rather than inferring `$type` from value syntax,
and adds an import (`largen theme`) as well as an export.

**6. Contract additions go into the structured contract source** (the one
`authoring-contract` requires), so SKILL.md, `llms-compact.txt` and the docs
site regenerate rather than being edited. The reference-tier and
out-of-scope text are contract entries with explanatory text, like every
other rule.

## Risks / Trade-offs

- [Coined-tag false positives make the lint noisy] → warning-first staging is
  the mitigation by design; the 0.6.1→0.7.0 gap is the feedback window, and
  the leading-token list is deliberately short.
- [The new error-severity checks fail a project that passed 0.6.1 clean] →
  intended: the component was already violating a SHALL NOT, and the RELEASES
  entry says so plainly. The size-variant check's modifier heuristic is scoped
  (size-axis suffix or `data-size` scope, *and* re-setting scale slots) so a
  legitimately named modifier like `--large-print` that sets non-scale slots
  is not caught.
- [SDK already rejects some malformed arguments, and double-validation drifts]
  → measure first (task-ordered); the added validator runs only where the SDK
  is confirmed permissive, and reads the same schema object.
- [Part 2 promotes the warning before anyone saw it] → sequencing: 0.6.1
  ships and deploys before 0.7.0 work begins; MIGRATING.md carries the
  promotion notice.

## Migration Plan

1. Part 1 lands → `largen build` (no CSS change; build id must not move — a
   moved id fails the release check), publish 0.6.1, deploy the site (MCP
   validation + evals go live with the deploy).
2. Part 2 lands → flip the severity constant, publish 0.7.0 with a
   MIGRATING.md entry for the lint promotion, alongside the `dtcg-token-layer`
   change's surface.
3. Rollback: each part is a normal npm release; a bad 0.7.0 is superseded, not
   unpublished, per the repo's immutable-version stance.

## Open Questions

- Whether the coined-tag check should also read `validate_spec` input (specs
  name components, not elements, so coverage may already follow from the
  manifest's `element` field) — decidable during implementation without
  changing the specs.

The DTCG questions moved to the `dtcg-token-layer` change with the design.
