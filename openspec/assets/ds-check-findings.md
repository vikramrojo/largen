# ds-check: Largen vs the design-systems corpus, and MCP vs MCP

Temporary findings, 2026-09-17. Input for a possible `/openspec-propose`.
Method: exercised the public Southleft Design Systems MCP
(`https://design-systems-mcp.southleft.com/mcp`, server v2.0.0, ~395 curated
entries / 348 tags) as an external reference corpus to judge largen's approach,
then probed that server's own robustness and compared it against largen's MCP
(`site/mcp/`, 11 tools).

---

## Part 1 — How sound is largen's approach, judged against the corpus

The corpus (Carbon, Material 3, css-tricks cascade-layers guide, DTCG,
Nathan Curtis "components as data", Storybook agent-docs guidance, Radix
accessibility, the 2025–26 agent-interface protocols) mostly *converges on*
the bets largen made. Specific alignments and gaps:

### Where largen agrees with the corpus

1. **Semantic/role-based tokens.** Carbon: "tokens are universal and never
   change across themes; the value is what a theme assigns." Largen's tones
   (`--tone`, `--tone-soft`, `--tone-ink`) and surface tokens are exactly this
   indirection layer; themes assign values, components consume roles. Sound.

2. **Cascade layers as the override mechanism.** The css-tricks guide in the
   corpus recommends precisely largen's architecture: a declared layer stack,
   third-party CSS slotted into a layer, unlayered author CSS winning by
   default, "a good way to adopt layers without rewriting your codebase."
   Largen's one-rule contract ("author inside `@layer largen.components`,
   override from outside") is the same mechanism stated as a discipline. The
   corpus also endorses sublayering within components — which is where largen's
   known failure mode (sublayer parenting) lives, and largen is ahead here:
   `check_layer_order` / `resolve_cascade` diagnose the failure the guide only
   warns about.

3. **Small owned vocabulary over a large adopted catalog.** The
   components-as-data and agent-docs entries (Curtis; Storybook AI best
   practices) push machine-readable component contracts: name, anatomy, slots,
   enumerated axes, "one concept per example." Largen's manifest + JSON-Schema
   validator + per-component `for`/`element`/`slots`/`contains` is a working
   instance of that idea, and the agent-facing `genai/` layer (allowlist,
   validator with no field for a colour/class/handler) matches the corpus's
   "capability guardrails" language from the A2UI ecosystem entry. This is the
   most current part of the corpus and largen sits comfortably inside it.

4. **Behaviour delegated to the platform** (`<dialog>`, `<details>`, Radix for
   the rest) matches the Radix accessibility entry's argument that semantics
   and interaction behaviour are the expensive part — largen declining to ship
   a `.modal` is the corpus-approved shape.

### Where largen diverges, or the corpus names a gap

1. **Two token tiers, not three.** Material 3 distinguishes reference → system
   → component tokens; Carbon similarly separates palette from role. Largen has
   roles (tokens) and slots, but no reference tier: a theme writes raw values
   straight into semantic tokens. At largen's size that is arguably a feature
   (less indirection), but a project scaling a brand across themes will
   reinvent the reference tier ad hoc. Worth one paragraph of guidance, not a
   mechanism.

2. **No DTCG interop.** The corpus carries the W3C Design Tokens format as a
   standard. Largen's tokens are not exportable/importable as DTCG JSON.
   `largen manifest` already derives structure from CSS; a `largen tokens
   --dtcg` emitter (and/or importer for a theme) would let largen plug into
   Style Dictionary / Figma pipelines the corpus assumes.

3. **Custom tag names carry no semantics.** `<notification data-tone="warning">`
   renders styled and inert: no role, no accessible name, `display: inline` by
   UA default until the component sets otherwise. The Radix/WCAG entries in the
   corpus are blunt about non-native controls needing ARIA. Largen's docs lean
   on the custom-tag spelling in the README's very first example. Nothing in
   the *mechanism* requires it — a class on a native element works identically —
   so this is a contract/documentation gap: the authoring contract should state
   "native element first; a coined tag is for containers with no interactive or
   landmark role," and `check_component_css` / `validate_spec` could warn when
   a spec coins a tag where a native element with the same role exists.

4. **Axes have no context dimension.** Material tokens resolve differently by
   context (density, form factor, RTL). Largen's axes are tone/variant/size/
   state; density and direction are unaddressed. Probably out of scope — but
   the spec should *say* it is out of scope and show the escape hatch (media/
   container queries inside a component are allowed and normal).

**Verdict:** the approach is sound by the corpus's own standards, and on the
agent-facing side (validated specs, structural safety, diagnostic tools) it is
ahead of what the corpus describes as current practice. The real gaps are
interop (DTCG) and one accessibility-adjacent authoring guidance hole (custom
tags), not architecture.

---

## Part 2 — Their MCP vs ours

### Different genera

- **Southleft**: a *retrieval* server. 5 tools (`search_design_knowledge`,
  `search_chunks`, `browse_by_category`, `get_all_tags`, `browse_by_tag`) over
  a curated corpus with pgvector + keyword search, on Cloudflare Workers.
  It answers "what does the field say."
- **Largen**: a *computational* server. 11 tools that are pure functions over
  caller-supplied input (contract, manifest-scoped validation, lint, cascade
  resolution, slot explanation, layer-order derivation, build identity,
  render-to-preview, probe emission). It answers "what will this CSS do, and
  why."

They are complements, not competitors: an agent would consult theirs to decide
*what* to build and ours to verify *that it built it correctly*. No finding
here says largen should become a knowledge base.

### Robustness probes on their endpoint (evidence, 2026-09-17)

| Probe | Their behaviour | Assessment |
|---|---|---|
| Empty `query` | Returns a **"Sample Design System" fixture entry** (`sample-button-guidelines.json`) | Test data leaked into the production corpus; an agent can cite it as if authoritative |
| `limit: "five"` (wrong type) | Silently returns "no chunks found" | Silent wrong answer — the worst error shape; schema not enforced server-side |
| `category: "nonsense"` (outside enum) | Soft "no entries found" | Enum declared in schema but not enforced; harmless here but same pattern as above |
| `limit: 100000` | Capped at 25 | Good |
| Unknown tool | JSON-RPC `-32603` internal error | Should be a tool-level error result; minor |
| Missing `Mcp-Session-Id` | Works fine | Effectively stateless while *issuing* session ids — harmless, but the session is theatre |
| Off-corpus query (utility-first vs semantic tradeoffs) | Returned adjacent Material-tokens content | Their README's claimed "relevance floor — an uncovered topic returns nothing rather than adjacent content" does not always hold |
| Corpus hygiene | One web.dev entry ingested in Portuguese | Ingestion doesn't pin locale |

### The same probes read against ours

- Errors are loud by design: malformed manifest → error, never silent fallback
  to the reference set; `resolve_cascade`/`explain_slot` report *undecidable*
  rules rather than dropping them; a skipped file says why it was skipped.
  This is the exact property their server lacks at the edges.
- Genuinely stateless (`sessionIdGenerator: undefined`), documented why;
  previews are the single stated exception, with expiry.
- JSON Schema declared once (low-level SDK, no Zod duplication); but note:
  like theirs, our enums (`theme`, `kind`) rely on SDK-side validation — worth
  confirming the SDK actually rejects out-of-enum values rather than passing
  them through (their server shows what it looks like when it doesn't).
- Tested: `site/test/run.mjs` + discovery + conformance ≈ 200 assertions over
  the live tool surface, including error shapes. They ship an eval harness
  (`scripts/eval-mcp.ts`) scoring *retrieval quality* — different axis; see
  below.
- Discovery: we expose `/.well-known/mcp/server-card.json`, `api-catalog`,
  `llms-compact.txt`, Link headers. Their endpoint has none of that (root URL
  serves a chat UI). We are ahead on machine discovery.

### What theirs does better (worth stealing)

1. **Outcome-level evals.** Their `eval-mcp.ts` scores whether tool answers are
   *substantively right* across difficulty tiers. Our tests assert shapes and
   known cases; nothing scores "given a broken stylesheet an agent actually
   authored, do our tools lead it to the fix?" The bake-off skill is adjacent
   but measures authoring, not the MCP.
2. **Browse/orientation tools.** `get_all_tags` / `browse_by_category` give an
   agent a cheap map before it searches. Our equivalent is `get_contract`
   sections — fine — but there is no one-call "what tools exist and when to use
   which" orientation beyond tool descriptions (the server card partially
   covers this).
3. **Source badging.** Every answer flags Primary/Authoritative/Community.
   Our diagnostic answers are self-evident, but `get_contract` could version-
   stamp each section (it stamps the build already — close enough; low value).

---

### Addendum (post-review): two lint false negatives

Hand-testing found that a dark-mode rule and a size variant written entirely
with tokens pass the lint clean — the existing checks are value-based (colour
literals), so `@media (prefers-color-scheme: dark) { .x { --bg:
var(--surface); } }` and `.x--lg { --pad: var(--pad-5); }` produce zero
findings despite both being contract SHALL NOTs (`component-authoring`). The
checks need to be structural, not value-based. Folded into the
`ds-check-followups` change as Part 1 error-severity rules (enforcing an
existing rule is a defect correction, per the 0.3.4 precedent).

## Toward an `/openspec-propose` — candidate changes, ranked

1. **Native-element-first authoring guidance + lint** (small, high value).
   Add to the contract: coined tags only for role-less containers; native
   element or ARIA role otherwise. Teach `check_component_css`/`validate_spec`
   to warn when a spec coins a tag whose name implies an interactive/landmark
   role (`<button-x>`, `<nav-…>`, `<dialog-…>`). Closes the one real gap Part 1
   found against the corpus.
2. **Server-side argument validation on our MCP** (small). Verify the SDK
   rejects out-of-enum/wrong-type arguments; if it does not, enforce in
   `guard()` so a wrong-typed call errors loudly instead of degrading — the
   failure mode observed on theirs.
3. **MCP outcome evals** (medium). An eval harness in the spirit of their
   `eval-mcp.ts`: seed broken-stylesheet scenarios (the known failure modes in
   SKILL.md), have an agent use only the MCP, score whether it reaches the fix.
   Turns "the tools exist" into "the tools work."
4. **DTCG token export** (medium). `largen tokens --dtcg` deriving a DTCG JSON
   from `src/tokens.css` + a theme, for Style Dictionary/Figma interop.
   Import is a separate, later question.
5. **Reference-token tier guidance** (docs only). One section: when a project
   outgrows two tiers, where the palette layer goes, without largen shipping
   one.
6. **Explicitly out of scope** (docs only): density/RTL contexts as axes; a
   knowledge-retrieval tool (Southleft's territory; complement, don't absorb).

## Raw probe log

Session: `Mcp-Session-Id: e5ff472c-…` (not actually required). Queries Q1–Q7
(custom properties/theming, cascade layers, semantic tokens, variant APIs,
utility-vs-semantic, AI guardrails, custom-element a11y) and robustness probes
R1–R7 as tabled above; all via `tools/call` over Streamable HTTP POST,
protocol 2025-03-26.
