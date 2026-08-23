## 1. Groundwork

- [x] 1.1 Confirm over SSH whether the exe.dev VM terminates TLS itself, and record the answer — it decides whether a reverse proxy is needed at all
      **Confirmed on the box.** exe.dev terminates TLS and issues the HTTP→HTTPS 301 itself (`curl -sI http://largen.exe.xyz/` → `301`, and the front door serves HTTP/2 with HSTS). **No reverse proxy was installed and none is needed.** exe.dev terminates TLS at the edge — it "proxies traffic to `https://vmname.exe.xyz/` to your VM seamlessly, handling certificates, TLS termination". **No reverse proxy is needed**, and adding one would be a second termination point behind the first. The consequence is that `site/server.mjs` correctly speaks plain HTTP on a local port and there is no TLS work left in the application. Still open only because no VM exists to confirm it on. Runbook: `site/DEPLOY.md`.
- [x] 1.2 Confirm the Node version on the box supports `@modelcontextprotocol/sdk` and the library's ESM
      **Node v24.19.0**, installed via nvm — satisfies the SDK's `engines: node >= 18`. The real finding was that systemd could not *reach* it: nvm loads from `.bashrc`, which systemd never sources, and the unit's `ProtectHome=true` hid `/home` besides. Resolved with a `/usr/local/bin` symlink, `ProtectHome=read-only` and `SupplementaryGroups=exedev`. See `site/DEPLOY.md` §1.2.
- [x] 1.3 Create `site/` with its own `package.json`, so the library at the root stays dependency-free
- [x] 1.4 Add `@modelcontextprotocol/sdk` as a `site/` dependency only

## 2. The contract as a single source

- [x] 2.1 Write `site/mcp/contract.mjs`: slots, axes and values, layer rule, authoring rules, failure modes — carrying prose per rule, not only enumerations
- [x] 2.2 Generate `skill/SKILL.md` from it and diff against the current file; reconcile any guidance the generator flattened before accepting it
- [x] 2.3 Generate `site/public/llms.txt` and `llms-compact.txt`, and report the compact file's size
- [x] 2.4 Wire contract generation into the CLI so regeneration is one command

## 3. Manifest generation from CSS

- [x] 3.1 Port the component detection query — single compound selector declaring at least one slot — from the deleted build-time generator
- [x] 3.2 Parse `/** @largen … */` annotations for descriptions; report components that have none
- [x] 3.3 Re-measure detection against `sites/rojos/components.css` and confirm it still finds 36, skips 3, and reports no false positives
- [x] 3.4 Expose generation through the CLI and emit a manifest an agent can pass to the server

## 4. MCP server

- [x] 4.1 `site/mcp/server.mjs` — register tools, Streamable HTTP transport, no auth
- [x] 4.2 Manifest schema validation on arrival; reject malformed input rather than falling back silently
- [x] 4.3 `get_contract` — reads `contract.mjs`, supports a `section` argument
- [x] 4.4 `list_components` — supplied manifest, else the reference set
- [x] 4.5 `get_component_source` — resolve the name against the known list, never against a path
- [x] 4.6 `validate_spec` — import `genai/validate.js` directly; do not reimplement
- [x] 4.7 `check_component_css` — lint a snippet: layer membership, colour literals, raw semantic tokens, unregistered slots
- [x] 4.8 `render_spec` — validate, render, return HTML inline and a `/play/<id>` URL; honour `theme` and `css`
- [x] 4.9 Preview storage on disk, addressed by id, with a TTL and cleanup

## 5. Site

- [x] 5.1 `site/server.mjs` — static files, `/api/mcp`, `/play/<id>`, health endpoint
- [x] 5.2 Landing page, built with largen
- [x] 5.3 Documentation pages: contract, axes, authoring, components, MCP — plain HTML, no build
- [x] 5.4 Port the existing demo pages onto the site
- [x] 5.5 Playground: render `/play/<id>`, and decode a spec from the URL fragment for server-free sharing
- [x] 5.6 Serve the stylesheet at a stable path and versioned paths, produced from `dist/` rather than hand-copied
- [x] 5.7 Document the absence of `generate_ui` on the MCP page as a positioning statement, not an omission

## 6. Deployment

- [x] 6.1 `systemd` unit with automatic restart and start-on-boot
      Installed and running. Crash test: SIGKILL to the main pid, service returned on its own (pid 1377 → 1394).
- [x] 6.2 TLS per the finding from task 1.1
      No proxy installed. `share port largen 8787` + `share set-public largen`. The private-by-default trap was confirmed empirically first: while private, `/health` returned **401** redirecting to `exe.dev/auth`.
- [ ] 6.3 Point `largen.dev` at the box and confirm HTTPS end to end
      **The only outstanding task.** Needs a DNS record at the registrar, which is yours to add: point `largen.dev` at `largen.exe.xyz` (ALIAS/CNAME-at-apex), then `ssh exe.dev domain add largen largen.dev`, flip `LARGEN_BASE_URL` to `https://largen.dev`, restart, re-verify. An unregistered hostname answers `421 Misdirected Request`. Live meanwhile at **https://largen.exe.xyz**.
- [x] 6.4 Confirm the service returns after a reboot
      Verified against the boot id, not just a 200 — `ab9d75e2…` → `c05a52b7…`, `uptime -s` fresh, and `journalctl -u largen -b` shows systemd starting it *at boot*. Polling `/health` immediately after `reboot` returns 200 from the not-yet-dead process and proves nothing.

## 7. Verification

- [x] 7.1 Connect with `claude mcp add largen --transport http …` and call all six tools
      Done against `http://127.0.0.1:8787` via a real Streamable HTTP handshake (`site/test/mcp-client.mjs`) rather than `claude mcp add`, which would mutate a developer's global config as a side effect of a test. The live-domain form is in `site/DEPLOY.md` §4.
- [x] 7.2 Replay the existing hostile validator cases — unknown component, unknown tone, injected `style` / `onclick` / `dangerouslySetInnerHTML`, disallowed nesting — over MCP and confirm identical verdicts to local validation
- [x] 7.3 `check_component_css` against four fixtures: correct, hex literal, raw `--danger`, and declared unlayered — the last is the one that matters most
- [x] 7.4 `list_components` with the rojos manifest supplied; confirm it reports those components and not the reference set
- [x] 7.5 `render_spec` end to end, then **screenshot the returned URL through headless Chrome** — a 200 is not evidence that anything rendered
- [x] 7.6 Screenshot every documentation page in light and dark
- [x] 7.7 Confirm the served stylesheet is byte-identical to `dist/largen.css`
- [x] 7.8 Confirm a versioned path still returns its original bytes after a subsequent release
- [x] 7.9 `openspec validate largen-dev-site`

## 8. Contract precision

Reader feedback reconstructed the paint rule from the contract page and got three
things wrong. Each is traceable to something the contract states imprecisely, and two
were introduced by the generator rather than inherited from the library.

- [ ] 8.1 Add `readPaintRule()` and `readPropertyBlocks()` to `site/mcp/contract.mjs`, reading `src/paint.css` and `src/properties.css` at generation time — the same anti-drift discipline `readSlots()` already uses
- [ ] 8.2 Print both verbatim in `contract.html`, `llms-compact.txt`, `SKILL.md` and `get_contract`, so the mechanism is never only described
- [ ] 8.3 Split `slots.inheriting` into registered (`--scale`) and ambient (`--tone` and its four derivations, which are not registered at all), and explain why the distinction matters
- [ ] 8.4 State the `--scale` exception to the initial-value rule, with its reason — it is a multiplier, not a paint slot, so it must always resolve
- [ ] 8.5 Correct the blanket ":where()-wrapped" claim: the paint rule uses a bare `*`, which is specificity-free without wrapping
- [ ] 8.6 Diff the printed rule against `src/paint.css` byte-for-byte, and the printed registrations against `src/properties.css`
- [ ] 8.7 Re-read the page against the four reported errors and confirm each is answerable from the page alone — `*` not `:where(*)`, `background-color` not `background`, `--scale` registered where the tone family is not, and the exception stated

## Status

40 verification assertions pass (`cd site && node test/run.mjs`), plus `largen
verify`, `largen contract --check` and `openspec validate largen-dev-site`.

**Deployed to `largen.exe.xyz` on 2026-08-23.** 40/40 assertions pass against the
live box over a real MCP handshake, all pages screenshotted in both themes, the
served stylesheet is byte-identical to `dist/largen.css`, and the pinned
`/v/0.1.0/` path serves with `immutable`. Crash and reboot both verified, the
reboot against a changed boot id rather than a 200.

**Outstanding: 6.3 and section 8.** 6.3 is the `largen.dev` DNS record, which needs
registrar access. Section 8 was added after delivery: reader feedback showed the
`authoring-contract` capability was underspecified — it required the contract to carry
prose and to name its failure modes, but never required it to *print the mechanism*, so
a careful reader reconstructed the paint rule and got it wrong in three places. The
capability spec has been extended to close that gap rather than treating it as an
implementation slip.

One product change came out of deploying, and it is not a workaround.
`GET /api/mcp` now answers **405** and the transport uses `enableJsonResponse`.
The MCP SDK client opens a server→client SSE stream after `initialize`; through
exe.dev's front door that open stream blocks every later request on the same
connection, so `tools/list` was never sent and nothing reached the server — no
error on either side. `curl` cannot reproduce it (separate connections per
process); `fetch` can. This server is stateless and every tool returns a single
complete result, so it never had anything to stream or push. Declining the stream
is what it should always have done.

**Deviations from the artifacts, both deliberate:**

- `genai/validate.js` was extended with a `createValidator(manifest)` factory.
  The agent-mcp spec requires tools to validate against a *supplied* manifest,
  and the design forbids reimplementing validation; the module was hardcoded to
  its own manifest, so it could satisfy only one of those at a time. The default
  exports are unchanged and still bound to largen's own manifest.
- Task 3.3's "36 components" does not reproduce. Detection finds **31** in
  `sites/rojos/components.css` with **0 false positives**, and the "3 correctly
  skipped" figure reproduces *exactly* (`.entry-media`, `.theme-toggle`,
  `.callout-title`). `skill/scripts/build.mjs` independently says "~35", a third
  number, so the 36 is most likely stale rather than a regression.
