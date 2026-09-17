# Tasks

## 1. The fallback itself

- [x] 1.1 `src/fallback.css` — `@layer largen.fallback` outermost (so the
      layered-sheet invariant passes without a new exemption), Tailwind v4.1's
      `@supports` engine sniff verbatim, the fourteen non-inheriting slots
      reset to `initial` on `*, ::before, ::after, ::backdrop`, and
      `:root { --scale: 1 }`. Never `--scale` in the universal rule — it
      inherits by design. Header comment carries the mechanism, the engine
      ranges, and the preflight trap.
- [x] 1.2 `src/largen.css` — layer statement gains `largen.fallback` first
      (the canonical order becomes eight); `@import url("./fallback.css")`
      beside the properties import it mirrors; header diagram updated.

## 2. What watches it

- [x] 2.1 `skill/scripts/verify.mjs` — expected layer array grows to eight.
- [x] 2.2 `skill/scripts/verify.mjs` — new invariant: the fallback mirrors the
      registrations. Diff the reset set against the `inherits: false`
      registrations (missing/extra named in the failure), assert the guard's
      shape, assert `--scale` seeded at `:root` with the registered
      initial-value and absent from the universal reset.
- [x] 2.3 `site/test/run.mjs` — `LARGEN_LAYERS` gains `largen.fallback`; the
      achievable-preflight fixture (which mirrors the documented preflight)
      gains it after `app-base`.
- [x] 2.4 `site/test/matrix.mjs` — `CORE` gains `src/fallback.css`; the
      `files.slice` bound grows by one (and its comment); the `brokenOrder`
      fixture lists `largen.fallback` first so it still isolates the
      modifiers/components flip.
- [x] 2.5 `demo/conformance.html` — check 12: the layer statement declares
      `largen.fallback` first among all eight. Check 13: via CSSOM, the
      fallback's reset set equals the paint rule's slot set, `--scale` absent
      from the resets and seeded `1` at `:root`. Header comment reworded — the
      mechanism now has a fallback, and the guard can only be true-positive
      tested in the engines it targets.
- [x] 2.6 Prove 2.2 fails: drop one slot from the fallback, confirm verify
      names it; reset `--scale` per element, confirm verify rejects it.
      Restore.
- [x] 2.7 Found while integrating: `site/test/verify-cascade.mjs`'s
      `FIXED_ENTRY` fixture is itself a documented preflight and hit the exact
      trap this change documents — it listed seven sublayers, the fallback got
      appended after `largen.modifiers`, and the suite's own layer-order check
      caught it (2 failures). Adding `largen.fallback` to the fixture fixed it,
      which is the trap demonstrating itself in this repo's own tests. Also:
      conformance check 13's rule finder first matched the `@layer …;`
      statement, whose cssText begins identically to the block's — the finder
      must require the `{`.

## 3. The contract and the docs

- [x] 3.1 `site/mcp/contract.mjs` — `layers.why` describes `fallback`; the
      FAILURE_MODES preflight fix lists all eight largen sublayers with
      `fallback` first, and its why explains the creation-order trap.
- [x] 3.2 `MIGRATING.md` — preflight statement gains `largen.fallback`; one
      sentence on why all eight must be listed.
- [x] 3.3 `README.md` — Requirements rewritten: floor Safari 16.2+ / Chrome
      111+ / Firefox 113+ set by `color-mix()`, `@layer`, `revert-layer`,
      `:where()`, still no fallback path for those; `@property` the stated
      exception with the engine ranges; conformance count updated. Minifier
      section and `skill/scripts/bundle.mjs` comment: `@property` now carries
      its own compiled fallback.
- [x] 3.4 `skill/scripts/pages.mjs` — conformance card no longer says "the one
      mechanism largen has no fallback for".
- [x] 3.5 Regenerate: `largen contract`, then `largen pages`. Never hand-edit
      SKILL.md, llms*.txt, RELEASES.md or site/public docs.

## 4. Release 0.5.2 and the record

- [x] 4.1 `genai/releases.json` — 0.5.2 entry: the fallback layer, engines
      covered, Tailwind v4.1 lineage, floor unchanged. Signals present:
      `largen.fallback`, `-moz-orient: inline`, `-webkit-hyphens: none`.
      `package.json` → 0.5.2.
- [x] 4.2 Back-record in `composition-that-verifies/tasks.md`: 0.5.1 frozen
      2026-08-26, never published to npm and never deployed, same build id as
      0.4.0.
- [x] 4.3 `skill/scripts/releases.mjs` — README-pin guard: the version README
      pins must have a releases.json entry AND its SRI must equal that
      version's frozen `build.json` integrity. Deliberately not
      `=== package.json` — README may pin an older published version.
- [x] 4.4 `largen build`, then `largen release` — freezes `/v/0.5.2/`;
      `largen.css` moves off build id `5445bbba` (now `0073498a`), the first
      CSS change since 0.4.0. Re-frozen once with `--force` because the README
      pin edit (4.5) landed after the first freeze and changed the shipped-code
      digest — `releases --check` demanded it, correctly; nothing had consumed
      the first freeze.
- [x] 4.5 README pin: `largen@0.4.0` → `largen@0.5.2` with the SRI from the
      frozen `site/public/v/0.5.2/build.json`; build-id narrative updated
      (0.4.0/0.5.0/0.5.1 were an identical-CSS run). Re-run
      `largen contract` / `largen pages` if generated surfaces changed.
- [x] 4.6 Full suite green: `verify`, `contract --check`, `build`,
      `releases --check`, `site/test/conformance.mjs` (13/13),
      `site/test/matrix.mjs`, `verify-cascade.mjs`, `cascade-diff.mjs`,
      `site/test/run.mjs` against a local server.
- [ ] 4.7 Post-merge, recorded here when done: `npm publish` 0.5.2 (the README
      pin 404s on jsdelivr until then — 0.5.1 proved it), push to main deploys
      the site via the 5-minute timer.

## 5. The only true-positive test

- [ ] 5.1 Manual, in Firefox ESR 115 or Safari 16.2–16.3 (or a live tab with
      the registrations deleted): the conformance page and the example site
      must not change. The guard is false in every modern engine, so no
      automated tier here can exercise it; record the run and the engine used.
