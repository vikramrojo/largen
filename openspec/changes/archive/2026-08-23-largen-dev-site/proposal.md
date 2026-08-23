# largen.dev — site and MCP server

## Why

largen is a CSS library built for agents to build on, but it currently has no
agent-facing surface beyond a local skill file and a repository an agent has to
read. An agent working in another codebase — finsum, rojos.us, anything — cannot
consult the authoring contract, check the component it just wrote, validate the
UI it wants to emit, or see the result.

The domain `largen.dev` is secured. It needs a home for the library, and that
home should expose an MCP server so those four things become tool calls.

[daub.dev](https://daub.dev) is the closest reference point — a CSS component
library for AI with zero build, a CDN, and an MCP server. largen inverts one of
its assumptions, and the inversion shapes this whole change: **daub's server
knows all 84 of its components because they are fixed; largen's premise is that
you write your own**, so the server cannot know `.entry-card` exists.

## What Changes

- **NEW** An MCP server at `https://largen.dev/api/mcp` over Streamable HTTP,
  exposing six tools. Tools accept an **optional component manifest**, so a
  project's own components are first-class rather than unknown; an agent with
  filesystem access supplies it and the server stays a pure function over its
  input.
- **NEW** `check_component_css` — a tool with no equivalent in daub, because
  daub's components are fixed and largen's are authored. It lints CSS an agent
  just wrote against the authoring contract.
- **NEW** One structured source for the authoring contract, from which
  `skill/SKILL.md`, `/llms.txt` and the `get_contract` tool are all generated.
  The contract is currently restated in three places and will drift.
- **NEW** Component manifest generation from a project's CSS, using the existing
  detection query, with descriptions taken from a `/** @largen … */` annotation
  beside each component.
- **NEW** A static documentation site — plain HTML styled with largen, no build
  step — plus `/llms.txt`, `/llms-compact.txt`, a spec playground at `/play`, and
  CDN delivery of the stylesheet at versioned, immutable paths.
- **NEW** Deployment to an exe.dev VM under `systemd`.

**Deliberately excluded: a `generate_ui` tool.** daub's flagship tool takes
natural language and returns a UI spec, which requires a server-side model. The
client here is already a capable model with full context about the app it is
building; a server-side one would add cost and latency while knowing less.
largen equips the caller (`get_contract`, `list_components`) and checks its work
(`validate_spec`) instead. This is a positioning statement, not an omission.

## Capabilities

### New Capabilities

- `agent-mcp` — the server, its transport, the six tools, their parameter and
  error semantics, and the decision to ship without authentication
- `authoring-contract` — a single structured source of the contract and the
  surfaces generated from it
- `component-registry` — manifest generation from CSS, the annotation format,
  and copy-in delivery of reference component source
- `documentation-site` — static documentation, the playground, and the
  `llms.txt` convention
- `hosting` — deployment, restart survival, TLS, and immutable versioned CDN
  paths

### Modified Capabilities

None. `openspec/specs/` is empty because the `build-largen` change is not yet
archived, so there is no baseline to write deltas against. This change relates to
`build-largen`'s `agent-authoring` and `generative-ui` capabilities — the MCP
server is a second delivery surface for both — but that relationship is described
here rather than expressed as a delta.

## Impact

- Adds `site/` to the repository. The library at the root is unchanged, so
  `npm publish` is unaffected.
- The MCP server imports `genai/validate.js` directly. One source of truth for
  the allowlist; any divergence between local and hosted validation is a wiring
  bug rather than a design choice.
- New runtime dependency on `@modelcontextprotocol/sdk`, confined to `site/`.
  The library itself stays dependency-free.
- The repository directory is renamed from `largen` to `largen-dev` to match the
  domain. The published package name remains `largen`.
- No authentication in v1: everything exposed is public documentation or a pure
  function over supplied input.
