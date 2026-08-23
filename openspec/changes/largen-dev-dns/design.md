# Design

## Context

Everything is in place except the record. The platform terminates TLS and issues the
HTTP→HTTPS redirect itself, so there is no application work — `site/server.mjs` speaks
plain HTTP on a local port and the front door handles the rest.

The one thing this cannot do without is registrar access, which is why it is its own
change rather than a task inside a delivered one.

## Decisions

### Attach the domain, keep the platform hostname

`largen.exe.xyz` continues to serve. Links shared during development — preview URLs from
`render_spec`, the addresses in commit messages and in `DEPLOY.md` — keep working. There
is no reason to break them and no cost to keeping both.

### DNS first, registration second

The platform verifies that a hostname resolves before it will accept traffic for it, so
the order is fixed: point the record, wait for it to resolve, then register. An
unregistered hostname returns `421 Misdirected Request`, which is a useful signal — it
means DNS arrived and registration did not.

### `LARGEN_BASE_URL` is the only thing to change in the service

`render_spec` builds preview URLs from it. Set wrongly, the tool returns links that 404
for whoever receives them, and nothing else notices. That makes it worth verifying by
opening a returned URL rather than by reading the config.

## Risks / Trade-offs

**Apex-domain DNS varies by registrar.** → A bare domain cannot take a plain CNAME. Use
whatever the registrar calls its flattened equivalent — ALIAS, ANAME, CNAME-at-apex — or
the record silently fails to resolve.

**Certificate issuance is not instant.** → The platform provisions on registration. A
first request may fail TLS before it completes; retry before diagnosing.

**The site is already public at the old hostname.** → Attaching a domain does not change
what is exposed, so there is no new decision about visibility here.

## Migration Plan

Nothing to migrate. Rollback is removing the domain registration; the exe.xyz hostname is
unaffected throughout.
