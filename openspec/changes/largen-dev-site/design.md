# Design

## Context

largen ships an algebra rather than a catalog: twelve custom-property slots, four
axes, one universal paint rule, and the expectation that each project writes its
own components. That premise is what makes an agent-facing server unusual to
design, because the obvious shape — a server that knows the component catalog —
is unavailable.

The library already has the pieces an agent needs. `genai/manifest.json` is an
allowlist, `genai/validate.js` rejects malformed model output, and
`skill/SKILL.md` teaches the authoring contract. What is missing is a way to
reach them from outside the repository. This change is mostly about *exposure*,
not new capability — with two exceptions noted below.

Hosting is an exe.dev VM: persistent Linux, SSH, HTTPS, root, `systemd`. That
means a plain Node process with a real filesystem, which removes several
constraints an edge runtime would impose — notably, preview storage needs no
key-value store, and the server can import the library's own modules directly
rather than bundling copies of them.

## Goals / Non-Goals

**Goals**

- An agent can learn the contract, check what it authored, validate what it
  emits, and see the result, without reading the library source.
- A project's *own* components are first-class, not a special case.
- One source of truth for the contract and one for validation.
- The site demonstrates the library's central claim by being built with it and
  requiring no build step.

**Non-Goals**

- Generating UI server-side. The caller is a better-informed model.
- Authentication. There is nothing private here in v1.
- A local stdio server. Deferred; the hosted one plus an agent's own filesystem
  access covers the same ground.
- Hosting other people's component registries. Copy-in only.

## Decisions

### 1. Tools take an optional component manifest

The obvious design — the server holds the catalog — cannot work when the catalog
is per-project. Three options were considered:

- **Server-side catalog.** Simple, and wrong: it would only ever know largen's
  reference components, making the tools useless in the projects that matter.
- **Local stdio server** reading the project's CSS directly. Highest fidelity,
  but requires installation, and gives largen.dev nothing to host.
- **Optional manifest parameter** — chosen. The calling agent already has
  filesystem access; it reads the project's CSS and passes the manifest in.

The consequence is architecturally pleasant: every tool is a pure function over
supplied input. The server holds no per-user state, needs no database, and can
be scaled or restarted freely. When no manifest is supplied, the tools fall back
to largen's reference set, which makes them useful for discovery too.

### 2. `check_component_css` — the tool the premise creates

daub has nothing like this because daub's components are fixed. In largen the
agent *writes* components, so the highest-value thing a server can do is tell it
whether what it wrote is correct.

The checks come from `skill/scripts/verify.mjs`, applied to a snippet rather than
a repository: no colour literals, no reaching past `--tone*` to a raw semantic
token, only registered slots used, and declaration inside
`@layer largen.components`.

That last check carries most of the weight. A component declared unlayered
outranks `largen.modifiers`, so `data-variant` silently stops working while
`data-tone` and `data-size` continue to — because those act through inheriting
custom properties rather than by overriding slots. One dead axis and two live
ones is the worst failure mode in the system: it looks like it works.

### 3. No `generate_ui`

daub's flagship tool turns natural language into a UI spec, which needs a model
on the server. Here the client is already a capable model that knows the
application being built, its data, and its conventions. A server-side model would
know none of that, and would add an API key, a cost, and a latency budget to
every call.

`get_contract` and `list_components` give the caller what it needs;
`validate_spec` checks the result. The division is deliberate and is worth
stating on the site, because its absence otherwise reads as an unfinished
feature.

### 4. One structured source for the contract

The authoring contract is currently written out three times — in `skill/SKILL.md`
for agents, in `README.md` for humans, and in `build-largen`'s `design.md` as
rationale. Adding `/llms.txt` and a `get_contract` tool would make five.

`site/mcp/contract.mjs` becomes the structured source; `SKILL.md`, `llms.txt`,
`llms-compact.txt` and the tool response are generated from it. The risk is
flattening — `SKILL.md`'s value is partly its prose, and a naive generator would
turn guidance into a table. The contract structure therefore carries prose fields
rather than only enumerations.

### 5. Validation is imported, never reimplemented

`site/mcp/tools/validate_spec.mjs` imports `genai/validate.js`. It would be
easier to reimplement the checks against the JSON Schema, and that is precisely
the trap: local and hosted validation would drift, and a spec that passed one
would fail the other. Because the module is shared, any divergence is a wiring
bug with an obvious fix rather than a slow correctness rot.

### 6. `render_spec` returns HTML inline as well as a URL

An agent without a browser can inspect returned HTML directly; a human wants a
link. Returning both costs nothing. Previews are written to disk with an id and a
TTL — trivial given a real filesystem, where an edge runtime would have needed a
key-value store and a cleanup story.

### 7. Documentation is static HTML with no build

The site's argument is that largen needs no build step, so a site that needed one
would undercut it. The documentation is roughly ten hand-written HTML files
styled with largen and served straight off the VM; `demo/*.html` is already
exactly this shape and ports directly.

The cost is manual content reuse across pages — accepted, at this size.

### 8. Manifest generation reuses an existing, measured query

Identifying components in a stylesheet is *"a rule that is a single compound
selector and declares at least one slot"*. This was written for a build-time
generator that a later design change deleted, and measured then against the rojos
component set: **36 components found, 3 correctly skipped, 0 false positives**.
The same query returns here for a different purpose, and is now optional rather
than load-bearing.

Descriptions are the part a stylesheet cannot supply, so they come from an
annotation beside the component:

```css
/** @largen Shows a single figure with a label. */
.stat { --gap: .15em; display: flex; flex-direction: column }
```

## Risks / Trade-offs

**TLS behaviour on exe.dev is unverified.** → The VM may terminate TLS already,
making a reverse proxy redundant, or it may not. Check over SSH before writing
deploy configuration rather than committing a Caddyfile that turns out to be
unnecessary.

**Node version on the box is unknown.** → Both `@modelcontextprotocol/sdk` and
the library's ESM need a current Node. Confirm before deploying.

**A supplied manifest is unvalidated input.** → It arrives from the network and
drives tool output. It must be schema-checked on arrival, and it must never be
used to construct a filesystem path in `get_component_source`.

**Contract generation may flatten `SKILL.md`.** → Mitigated by carrying prose in
the contract structure, and by diffing the generated `SKILL.md` against the
current one when the generator lands.

**Static checks still cannot see rendering.** → The library's own history is the
argument: twelve static checks passed while six components were visibly broken.
`render_spec` output must be screenshotted in verification, not merely asserted
to return 200.

**The site duplicates the stylesheet.** → `public/largen.css` must be produced
from `dist/largen.css` rather than hand-copied, or the CDN will silently serve a
stale library.

## Migration Plan

No consumers exist, so there is nothing to migrate. Deployment order is: verify
the box, run the server on a port, confirm the six tools over MCP, then put it
behind the domain.

Rollback is stopping the service; the library is unaffected by any of this and
continues to work from a local file or npm.

## Open Questions

- Does exe.dev terminate TLS for the VM, or is a reverse proxy required?
- Should `/llms.txt` link to per-page markdown, or is `llms-compact.txt` inline
  sufficient given how small the contract is?
- Is a local stdio server worth adding once the hosted one has been used in
  anger?
