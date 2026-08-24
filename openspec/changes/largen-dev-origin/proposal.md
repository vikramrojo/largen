# Make largen.dev an origin agents can find

## Why

The site and its MCP server are live and verified at `largen.exe.xyz`. What is missing is
the domain the project is named after.

This was task 6.3 of `largen-dev-site`. It is separated out because it is blocked on
something external to that change — a DNS record at a registrar — and leaving it open
held the whole change unarchived, which in turn left `openspec/specs/` empty and gave
three subsequent rounds of work nothing to write deltas against. A task blocked on
someone else's system should not block a delivered change from being recorded as
delivered.

An agent-readiness audit then found fourteen missing discovery surfaces. They belong in
this change rather than a new one, because this change owns their blocker: `robots.txt`
and `sitemap.xml` need an absolute canonical origin, and DNS-AID needs DNS. Renamed from
`largen-dev-dns` accordingly — it is about which origin is canonical and how it is found,
not only about a record at a registrar.

Read as an SEO checklist that audit is busywork. Read against how agent tooling is
adopted it is not: a harness builder assembles scaffolds from skills and MCP servers, and
being present where that assembly happens is distribution. largen ships the two things
that matter there — a real MCP server at `/api/mcp` and a real skill at `/skill/SKILL.md`,
both already served — and neither was discoverable by the mechanisms designed to find them.

## What Changes

- **NEW** `largen.dev` resolves to the deployed VM and serves the site over HTTPS.
- The platform terminates TLS, so no reverse proxy is introduced. That was established
  in `largen-dev-site` task 1.1 and holds.
- **NEW** `robots.txt` and `sitemap.xml`, both generated, with the sitemap listing every
  canonical page and nothing else.
- **NEW** `/.well-known/mcp/server-card.json` and `/.well-known/agent-skills/index.json`,
  derived from `TOOL_DEFINITIONS` and the skill's own bytes rather than written by hand.
- **NEW** `/.well-known/api-catalog` (RFC 9727) and `Link` headers on the landing page.
- **NOT** published: `openid-configuration`, `oauth-protected-resource`, `auth.md`. This
  site has no authentication — the MCP server is unauthenticated by design and says so —
  and those files would describe an authorization server that does not exist.

## Capabilities

### New Capabilities

- `custom-domain` — attaching a name the project owns to the running service, and what
  must be true before and after
- `agent-discovery` — the surfaces by which an agent, or the tooling a harness builder
  assembles, finds what this origin hosts; and the rule that each is derived from the
  thing it describes rather than maintained beside it

### Modified Capabilities

None. `hosting` covers TLS termination, restart survival and immutable versioned paths;
it says nothing about which hostname answers. This adds that without changing any of it.

## Impact

- `LARGEN_BASE_URL` moves from `https://largen.exe.xyz` to `https://largen.dev`, which
  changes the preview URLs `render_spec` returns. Nothing else in the service reads it.
- The exe.xyz hostname keeps working; the platform serves both.
- Documentation already refers to `largen.dev` throughout, including `package.json`'s
  `homepage`. Those references become true rather than aspirational.
- The canonical origin is a committed literal in `site/canonical.mjs`, not an environment
  variable: the surfaces that embed it are compared byte-for-byte by `contract --check`,
  and reading it from the environment would make two machines generate two different files.
  It names the host that answers today and moves in one edit when DNS lands.
- The deployed unit currently sets `LARGEN_BASE_URL=https://largen.exe.xyz` while the unit
  file in the repository says `https://largen.dev`. Task 1.4 reconciles them.
