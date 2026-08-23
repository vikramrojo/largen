# Tasks

## 1. Packaging defects found while scoping this change

- [x] 1.1 Add `skill/scripts/bundle.mjs` to `files[]` — `build.mjs` imports it and
      it was never published, so `largen build` from an install failed on module
      resolution.
- [x] 1.2 Make `build.mjs` skip a profile whose entry is absent, naming it. The
      example-site profile reads `sites/example/`, which the package deliberately
      does not ship.
- [x] 1.3 Prove it: `npm pack`, install the tarball into a scratch project, run
      `npx largen build`. Prove it can fail: remove `bundle.mjs` from the install
      and see it break.

## 2. Two surfaces of one linter disagreeing

- [x] 2.1 Add `classifySheet()` to `genai/lint.js` — `component` / `not-component`
      / `minified`, with the reason. Test the `@layer` statement trap, which a
      substring check gets wrong.
- [x] 2.2 Point `skill/scripts/verify.mjs` at it, replacing its private copy.
      Confirm the counts are unchanged.
- [x] 2.3 Classify before linting in `check_component_css`'s batch form; report
      `kind` and the skip reason per file, and both counts in the summary.
- [x] 2.4 Leave the single-string form unclassified — one snippet means "check this
      component", and classifying it away would lose the layer finding.
- [x] 2.5 Reproduce the reporter's case: a components directory plus token sheets.
      Confirm the spurious findings are gone and measure what they were.

## 3. Deriving load order instead of trusting it

- [x] 3.1 Add `orderFromImports(files, entry)` to `genai/layers.js`, resolving
      within the provided set only — no filesystem, since the server gets strings.
- [x] 3.2 Handle all five `@import` spellings, `..` traversal, repeats and cycles.
- [x] 3.3 Report rather than guess: unresolved specifiers, remote stylesheets,
      `layer()` conditions, and files the entry never reaches.
- [x] 3.4 Accept `entry` in `check_layer_order`; surface the derivation and its
      caveats; keep the honest note when no entry is given.
- [x] 3.5 Prove it does something: a case where the given order and the derived
      order disagree.

## 4. Baseline

- [x] 4.1 Archive `migration-support` before writing new deltas, so these are
      deltas against a real capability rather than sections of finished work.
- [x] 4.2 Restore the five scenarios its MODIFIED blocks would have dropped, found
      by comparing scenario sets against the baseline rather than one failed
      archive at a time.
- [x] 4.3 Confirm the archive lost nothing: 14 capabilities, 85 requirements,
      172 scenarios.

## 5. `emit_probe`

- [x] 5.1 `genai/probe.js`: generate a self-contained computed-value document from
      stylesheet references, selectors, properties and themes.
- [x] 5.2 Interaction probes: steps and assertions, with an assertion whose target
      never appeared reported as failed rather than passed.
- [x] 5.3 Escape every caller-supplied string into the document. The server does
      not execute it, but the caller's browser will.
- [x] 5.4 MCP tool + `largen probe` CLI verb over the same function.
- [x] 5.5 Run a generated computed probe against `sites/example/` in headless
      Chrome and confirm the table populates.
- [x] 5.6 Run a generated interaction probe and confirm a deliberately false
      assertion fails — a harness that verifies nothing passes everything.

## 6. `explain_slot`

- [x] 6.1 `genai/cascade.js`: match a selector against an ancestor chain. Return
      undecidable, with the offending construct, for anything a linear chain
      cannot answer.
- [x] 6.2 Resolve one slot: which rule set it, in which layer, and whether the
      paint rule applies it or `revert-layer` fires.
- [x] 6.3 Detect the keywords that leave a registered slot guaranteed-invalid, and
      name the declaration responsible.
- [x] 6.4 A UA-default table for the 14 properties the paint rule touches, labelled
      with its engine and separated from the derived answer.
- [x] 6.5 MCP tool + CLI verb.
- [x] 6.6 `--fg: inherit` on a link warns and recommends `currentColor`;
      `--fg: currentColor` does not warn.
- [x] 6.7 `--bg: initial` is reported as the compat idiom stripping the slot, not
      as an absent rule.

## 7. `resolve_cascade`

- [x] 7.1 Generalise the matcher to arbitrary properties; add specificity,
      `:where()`/`:not()` zeroing, `!important` and source order to the existing
      layer order.
- [x] 7.2 Return every matching declaration in cascade order with the winner and
      the reason, naming sublayer parenting where that decided it.
- [x] 7.3 Report undecidable rules explicitly and point at `emit_probe`.
- [x] 7.4 Return `calc()` and unresolved `var()` as written; report
      `inherits: false` and stop rather than walking the chain.
- [x] 7.5 Accept a viewport width, or report per-condition; do not evaluate
      `@media` silently.
- [x] 7.6 MCP tool + CLI verb.

## 8. Differential verification — the ship gate

- [x] 8.1 Fixtures from the report's four real cases plus largen's own stylesheets.
- [x] 8.2 Resolve each statically, run the same case in headless Chrome via a
      generated probe, compare.
- [x] 8.3 `--weight: 900` computing as `300` must reproduce, and the reason given
      must be sublayer parenting.
- [x] 8.4 Gate: no fixture where static and browser disagree without the resolver
      having said "undecidable".
- [x] 8.5 A fixture whose answer turns on `:last-child` must come back undecidable.
      Assert it — a resolver that guesses right by accident passes a naive test.

## 9. Contract and release

Findings that changed the design, recorded because the reasoning is not visible
in the result:

- The classifier in §2 first used "declares inside `@layer largen.components`"
  alone, and the suite caught it discarding an **unlayered component** — the one
  finding the linter values most, thrown out on the strength of the very error
  being looked for. It now also counts a file that sets paint slots while using no
  largen layer, and excludes files declaring in largen's other layers, which are
  the library's own algebra rather than a component that forgot something.
- `emit_probe` settled with a double `requestAnimationFrame` and hung forever in
  headless Chrome, which produces no frames. A harness stuck at "running…" reads
  as "still working" — the silent non-verification this tool exists to prevent —
  so settling now races rAF against a timeout and page loads time out too.
- The differential suite's first two failures were not cascade errors. It was
  comparing a declaration as written against a computed value, which are different
  questions whenever the winner is an expression.

- [x] 9.1 `largen contract --check`; confirm the new tools reach `SKILL.md`,
      `llms.txt` and `llms-compact.txt`, and that compact stays inside 16kb.
- [x] 9.2 Extend the assertion suite and run it locally — 70 assertions, plus an
      11-fixture differential suite against headless Chrome.
- [x] 9.4 Run the suite against the deployed site — 77/77 against
      `https://largen.exe.xyz`. Note the site is not yet on `largen.dev`: that
      needs the DNS record in `largen-dev-dns`, which is blocked on registrar
      access.
- [x] 9.3 `largen verify` and the conformance page still pass.

## 10. A release log by version

A changelog is the one document in a repository that nothing verifies. It is
written at the moment of least certainty, from memory, about finished work, and
read by people deciding whether an upgrade will break them. largen freezes every
release at an immutable path, so the bytes each version shipped are still on disk
and the log can be checked instead of trusted.

- [x] 10.1 `genai/releases.json` — the log as data. Each entry carries `signals`:
      strings that must be present in, and absent from, that version's frozen
      `largen.css`.
- [x] 10.2 Generate `RELEASES.md` from it in `largen contract`, so the published
      log cannot drift from the data.
- [x] 10.3 `largen releases --check` verifies every entry against the frozen bytes
      at `/v/<version>/`, and fails on a published version with no entry. Proved it
      can fail by asserting two things that were never true.
- [x] 10.4 Extend `largen contract --check` to every generated surface. It checked
      only `SKILL.md`, so it reported "all current" while three other files it never
      opened could be stale.
- [x] 10.5 Write the 0.1.0, 0.2.0 and 0.3.0 entries from the frozen artifacts
      rather than from memory — diffing the builds is what established that the
      explicit `@layer` statement and the banner both post-date 0.2.0.
- [x] 10.6 Bump to 0.3.0, rebuild, freeze at `/v/0.3.0/`, and confirm the frozen
      bytes match the `sha256` and `integrity` their own `build.json` claims.
- [x] 10.7 Point the README's pin example at 0.3.0 with the real integrity string,
      and document the three new CLI verbs.
- [x] 10.8 Publish: deployed at 6b1e9d0. `/v/0.1.0/`, `/v/0.2.0/` and `/v/0.3.0/`
      all serve, and 0.3.0's served bytes reproduce the `sha256` its own
      `build.json` publishes.
- [ ] 10.9 `npm publish` — blocked, not declined. The registry now requires
      interactive browser authentication for a publish; the cached token in
      `~/.npmrc` is read-only, which is why `npm whoami` succeeds and `npm publish`
      does not. The package is otherwise ready: `npm publish --dry-run` is clean at
      45 files / 86.6 kB, the name `largen` is unregistered, and `dist/largen.css`
      in the tarball is byte-identical to the pinned `/v/0.3.0/largen.css`, so a
      registry CDN and largen.dev will serve the same bytes under the same SRI.
      Run `npm login` then `npm publish --access public`.

**This unblocks T5.** `check_upgrade` was deferred because it needed a
machine-readable list of behavioural deltas keyed by version, which `build.json`
did not carry. `signals` is that list: given a project's CSS and the version it
vendored, the `present` strings of every later release are exactly what to grep
for. T5 is now a tool to write rather than a prerequisite to invent.
