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
- [ ] 2.7 `openspec validate largen-dev-dns`
