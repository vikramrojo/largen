## 1. Attach the domain

- [ ] 1.1 Point `largen.dev` at `largen.exe.xyz` — ALIAS, ANAME or whatever the registrar calls a flattened apex record, since a bare domain cannot take a plain CNAME
- [ ] 1.2 Wait for it to resolve — `dig +short largen.dev` — before registering, because the platform verifies resolution first
- [ ] 1.3 `ssh exe.dev domain add largen largen.dev`, then confirm with `domain ls`
- [ ] 1.4 Set `LARGEN_BASE_URL=https://largen.dev` in the unit and restart

## 2. Verify

- [ ] 2.1 `curl -sI http://largen.dev` redirects to HTTPS, and `curl -s https://largen.dev/health` answers
- [ ] 2.2 A `421 Misdirected Request` means DNS landed but registration did not — check for it before diagnosing anything else
- [ ] 2.3 `render_spec` returns a `largen.dev` URL, and **open it** — a preview link that 404s for its recipient is the failure this task exists to prevent
- [ ] 2.4 `largen.exe.xyz` still serves, so links shared earlier keep working
- [ ] 2.5 Full suite against the new domain: `LARGEN_BASE_URL=https://largen.dev node site/test/run.mjs`
- [ ] 2.6 Screenshot the site at the new domain in both themes
- [ ] 2.7 `openspec validate largen-dev-origin`

## 3. Discovery surfaces

Generated into `site/public/` by `largen pages`, so they are committed, diffable and
covered by `contract --check`. All derived: the tool list from `TOOL_DEFINITIONS`, the
page list from the two generators that produce the pages, the skill digest from the
skill's own bytes. Hand-writing any of them recreates the drift that had this site
advertising six MCP tools when there were twelve.

- [x] 3.1 `site/canonical.mjs` — one committed literal for the canonical origin, with
      why it is not read from the environment.
- [x] 3.2 `robots.txt` — RFC 9309, allow all, explicit AI-crawler groups, a
      `Content-Signal` line, and the sitemap.
- [x] 3.3 `sitemap.xml` — every canonical page, `404.html` excluded, `/play` in the form
      the nav actually links.
- [x] 3.4 `/.well-known/mcp/server-card.json` — SEP-1649, marked in-document as
      pre-merge.
- [x] 3.5 `/.well-known/agent-skills/index.json` — the skill, with a sha256 of the bytes
      it names.
- [x] 3.6 `/.well-known/api-catalog` — RFC 9727 linkset, served as
      `application/linkset+json`.
- [x] 3.7 `Link` headers on `/` — relative references, so they stay correct on both
      hostnames without the server knowing which answered.
- [x] 3.8 `.xml` and `.md` in the server's `TYPES` map, and caller headers given
      precedence over the extension default so a file can state its own media type.

## 4. Verify the surfaces

- [x] 4.1 `site/test/discovery.mjs` — 17 assertions. Absolute URLs are rebased onto the
      origin under test, because resolving them verbatim made the sitemap check pass by
      fetching the deployed site while the local file was never opened.
- [x] 4.2 Prove each can fail: a digest that does not match its bytes, a sitemap listing a
      dead URL, a card claiming a tool the server does not expose.
- [x] 4.3 Assert the absent files stay absent — if authentication is ever added, that
      assertion is what should fail first.
- [x] 4.4 Confirm `contract --check` covers all five, individually.
- [ ] 4.5 Re-run against the deployed origin once shipped.

## 5. DNS-AID

Needs Part 1 first — it cannot precede the name it publishes under — and DNSSEC on the
public zone. An IETF draft, so worth doing once the name resolves and not worth blocking
the rest on.

- [ ] 5.1 Publish `_index._agents.largen.dev` as a ServiceMode SVCB record with `alpn`
      and the endpoint.
- [ ] 5.2 Sign the discovery zone with DNSSEC so validating resolvers return
      authenticated data.
- [ ] 5.3 Verify with `dig +dnssec` from a validating resolver, not only from the
      registrar's own console.

## 6. After the domain lands

- [ ] 6.1 Flip `CANONICAL` in `site/canonical.mjs` to `https://largen.dev`, regenerate,
      and confirm `contract --check` is the thing that notices if you forget.
- [ ] 6.2 `LARGEN_BASE_URL=https://largen.dev node site/test/discovery.mjs` — with the
      rebase now a no-op, this checks the deployed reality rather than the local files.
