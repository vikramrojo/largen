# Proposal

## Why

The ds-check evaluation (`openspec/assets/ds-check-findings.md`, 2026-09-17)
judged largen against an external design-systems corpus and probed largen's MCP
against the Southleft retrieval MCP. The architecture held up; the gaps found
were narrow and nameable: coined tags like `<notification>` carry no semantics
and nothing warns when an authored component coins a tag where a native element
with the same role exists; the MCP's argument validation was never confirmed to
reject out-of-schema input loudly (the failure mode observed on the comparison
server was silent degradation); tokens have no DTCG interop; and the contract
is silent on two things projects will ask about — the reference-token tier and
density/RTL contexts. Fixing these now, split by release discipline, keeps each
fix in the smallest release that can carry it.

## What Changes

**Part 1 — patch (0.6.1).** Nothing here changes `src/*.css`; the build id does
not move.

- Extend the native-element-first rule from the library to authored components:
  the contract states that a coined tag is for containers with no interactive
  or landmark role, and a native element (or an explicit role) is required
  otherwise.
- The lint (`check_component_css`, `largen verify`) gains a **warning** when a
  component or spec coins a tag whose name implies an interactive or landmark
  role (`button-*`, `nav-*`, `dialog-*`, …). A warning, not an error: projects
  that passed `verify` clean yesterday still pass today.
- Two lint false negatives fixed, as **errors** from the start: a dark-mode
  rule in a component, and a hand-written size variant, are now caught even
  when written entirely with tokens. Today the linter only catches a dark
  block if a colour literal happens to sit inside it, so two of the contract's
  existing SHALL NOTs (`component-authoring`: no dark-mode rules, no size
  variants) have no check behind them — and the bake-off showed guidance
  without a check does not change agent output. Errors, not warnings, because
  these enforce rules that already exist: a component they flag was always
  non-conformant, and the 0.3.4 precedent ("the conformance assertions now
  run") treats a check that did not check as a defect correction, which is
  patch material.
- The MCP rejects out-of-schema arguments loudly: a wrong-typed or out-of-enum
  argument is an error result, never a silently degraded answer.
- Contract additions (docs surfaces regenerate; no behaviour change): what to do
  when a project outgrows two token tiers, and an explicit statement that
  density/RTL contexts are out of scope with the escape hatch named
  (media/container queries inside a component are allowed and normal).
- Deploy-only, no release artifact: MCP outcome evals — scenario-seeded checks
  that an agent using only the MCP tools reaches the documented fix for each
  known failure mode.

**Part 2 — patch (0.6.2).** No new surface, and no CSS change.

- DTCG interop: superseded by the `dtcg-token-layer` change, which exports the
  token documents from `largen build` and imports them with `largen theme`
  instead of adding `largen tokens --dtcg`. That surface shipped in 0.6.0; what
  remains here is the lint promotion below.
- **BREAKING**, shipped as a patch because 0.6 has no users to protect and the
  release log carries the warning in its `breaking` list: the coined-tag lint
  warning from Part 1 is promoted to an error. A component that coins a
  role-implying tag now fails `largen verify` and `check_component_css`.

## Capabilities

### New Capabilities

None. Every change lands in an existing capability.

### Modified Capabilities

- `component-authoring`: the existing native-element-first requirement (library
  scope) extends to authored components — coined tags only for role-less
  containers.
- `authoring-contract`: the contract SHALL state the coined-tag rule, the
  two-tier-to-reference-tier guidance, and the density/RTL out-of-scope
  declaration with its escape hatch.
- `agent-mcp`: (1) the lint tool warns — later errors — on role-implying coined
  tags; (2) the lint errors on dark-mode rules and hand-written size variants
  in component CSS, token-valued or not; (3) out-of-schema tool arguments
  SHALL produce an error result rather than a degraded answer.

`design-tokens` was modified here too, for the DTCG export; that delta now lives
in the `dtcg-token-layer` change.

## Impact

- `genai/lint.js`, `skill/scripts/verify.mjs` — coined-tag check (warning in
  Part 1, error in Part 2).
- `site/mcp/tools/index.mjs`, `site/mcp/server.mjs` — argument validation;
  `site/` is not in the published npm `files`, so this is a deploy, not part of
  the release surface.
- `site/test/` — new eval harness alongside the existing ~200-assertion suite.
- Contract source and its generated surfaces (`llms-compact.txt`, SKILL.md,
  docs site) — three new contract statements.
- The DTCG surface (a new CLI subcommand and the `package.json` files it adds)
  moved to the `dtcg-token-layer` change.
- Release sequencing: Part 1 ships as 0.6.1; Part 2 as 0.6.2. Part 2's lint
  promotion depends on Part 1's warning having shipped.
