# Attach largen.dev to the deployed site

## Why

The site and its MCP server are live and verified at `largen.exe.xyz`. What is missing is
the domain the project is named after.

This was task 6.3 of `largen-dev-site`. It is separated out because it is blocked on
something external to that change — a DNS record at a registrar — and leaving it open
held the whole change unarchived, which in turn left `openspec/specs/` empty and gave
three subsequent rounds of work nothing to write deltas against. A task blocked on
someone else's system should not block a delivered change from being recorded as
delivered.

## What Changes

- **NEW** `largen.dev` resolves to the deployed VM and serves the site over HTTPS.
- The platform terminates TLS, so no reverse proxy is introduced. That was established
  in `largen-dev-site` task 1.1 and holds.

## Capabilities

### New Capabilities

- `custom-domain` — attaching a name the project owns to the running service, and what
  must be true before and after

### Modified Capabilities

None. `hosting` covers TLS termination, restart survival and immutable versioned paths;
it says nothing about which hostname answers. This adds that without changing any of it.

## Impact

- `LARGEN_BASE_URL` moves from `https://largen.exe.xyz` to `https://largen.dev`, which
  changes the preview URLs `render_spec` returns. Nothing else in the service reads it.
- The exe.xyz hostname keeps working; the platform serves both.
- Documentation already refers to `largen.dev` throughout, including `package.json`'s
  `homepage`. Those references become true rather than aspirational.
