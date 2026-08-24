# Tasks

## 1. Run the conformance page

- [x] 1.1 Add a hidden machine-readable results element to `demo/conformance.html`,
      alongside the table. Follow `genai/probe.js`: a driver that can read
      `--dump-dom` is a lighter dependency than one that can evaluate script.
- [x] 1.2 `site/test/conformance.mjs` — serve, open the page in headless Chrome,
      read the results, exit non-zero on any failure. Pattern:
      `site/test/cascade-diff.mjs`.
- [x] 1.3 Assert the reported count equals the number of `check(` calls in the
      source. `skill/scripts/pages.mjs:49` already derives that number; reuse it
      rather than writing a second one.
- [x] 1.4 Report clearly when no browser is available. Never report success for a
      suite that did not execute.
- [x] 1.5 Prove it fails, then restore: (a) break one assertion, confirm non-zero
      exit; (b) make the source declare more checks than the page executes, confirm
      the count assertion catches it; (c) point `CHROME` at nothing and confirm it
      reports that the suite did not run rather than passing.

      **(b) was worded wrong here and the implementing agent caught it.** Deleting a
      `check(` call cannot fail, because the expected count is derived live from the
      same file — both sides drop together, and a suite that has legitimately shrunk
      *should* pass. The drift the spec actually describes is the source declaring
      more checks than the page runs, which is a commented-out body rather than a
      deleted one. Live derivation stays: a count written by hand goes stale, and in
      this repo it has five times.

## 2. The axis matrix

- [x] 2.1 `genai/matrix.js` — generate the 7 × 4 × 5 × 2 combinations and build an
      ancestor path carrying the axis attributes. Reuse `synthesizePath` and
      `resolveProperty` from `genai/cascade.js`.
- [x] 2.2 For every reference component, assert each of the four axes changes which
      declaration wins for at least one slot. This is the structural half of the
      four-axes claim and needs no browser.
- [x] 2.3 A rendered sample via `buildProbe` confirming values actually differ —
      static resolution cannot show this, because `--tone` inherits and
      `resolveProperty` does not substitute `var()`.
- [x] 2.4 Report which states were rendered and which were not. A bound that is not
      stated reads as full coverage.
- [x] 2.5 Prove it fails: remove a component's `--bg` declaration and confirm the
      axis it depends on is reported as unreached.
- [x] 2.6 Decide where it runs — `verify`'s library-invariants branch is about
      largen's own guarantees and is the closest fit, but a separate command keeps
      `verify` about the caller. Record the decision in `design.md`.

## 3. `largen eval`

- [x] 3.1 `skill/scripts/eval.mjs` — score a directory of authored components.
      Offline, deterministic, no model.
- [x] 3.2 Metrics from existing code: colour-literal and raw-token escape rates and
      layer placement from `genai/lint.js`; whether declarations apply from
      `checkComponentsApply`; axis coverage from the matrix; theme survival from
      `genai/probe.js`; tokens per component by counting.
- [x] 3.3 Two-directory mode reports both and declares no winner.
- [x] 3.4 The result states that conformance is not appearance, and points at the
      rendered tiers.
- [x] 3.5 Where output is used to compare substrates, state the asymmetry: a
      substrate familiar from training data against one read from a contract file.
      A largen win is conservative; a largen loss is confounded.
- [x] 3.6 Register the command in `skill/scripts/cli.mjs`, add it to the contract's
      command list, and add the script to `files[]` — the packaging defect that
      shipped a command whose module was absent happened once already.
- [x] 3.7 Prove it is deterministic: score the same input twice, compare byte for byte.

## 4. One stale reference

- [x] 4.1 `site/test/shots.mjs` screenshots `/demo/`, which was removed and 404s.
      Drop it.
- [x] 4.2 Have `shots.mjs` check each path resolves before shooting. It writes
      images rather than asserting, which is why the stale entry survived — the
      same generated-but-unchecked shape that has now bitten four times.

## 2b. Corrections found while integrating group 2

- [x] 2b.1 **My interface contract named the wrong fourth axis.** largen's four are
      tone, variant, size and **state**; I specified theme. State is the
      `UNDECIDABLE_PSEUDO` set by construction — `resolveProperty` can never decide
      it and `emit_probe` cannot synthesise `:hover` either — so the matrix covers
      theme and says plainly that state is not covered rather than implying four.
- [x] 2b.2 **The suite asserted that gaps exist.** `assert(partial.length > 0)` made
      it pass because largen has gaps and fail if largen were flawless — backwards
      for a gate. Provability belongs in the fixture, not in the assertion guarding
      the real library.
- [x] 2b.3 **Findings are gated on participation.** Ungated, the check reported 71
      errors against a correct library, most against layout utilities: `.stack` sets
      `--gap` and has no colour for a tone to change. That asks an author to paint
      what largen deliberately leaves alone — failure mode F6 — and is a finding no
      repair can clear.
- [x] 2b.4 **Only variant is gated; tone, size and theme are census.** Setting
      `--bg` obliges `largen.modifiers` to outrank it — a fact about layer order,
      true for every value. Tone is a choice: `card`, `panel`, `prose` and `divider`
      use `--surface` on purpose. The genuine tone defect is a colour literal, which
      `genai/lint.js` already reports; duplicating it would give two answers that
      could disagree. Size is opt-in — nothing resizes unless it multiplies by
      `var(--scale)`.
- [x] 2b.5 **The failure fixture was rewritten twice as the gate sharpened**, and
      each break was informative. It now keeps an identical, correctly layered
      component and flips the layer order so modifiers sort before components —
      the reporter's own bug, where nothing in the component's file looks wrong.

## 4b. Deduplicate what the split produced

- [x] 4b.1 `eval` was written with its own copies of `discover()` and `inferEntry()`,
      because neither is exported and `verify.mjs` was outside its scope. The
      implementing agent flagged it rather than reaching outside its lane, which was
      right — and the two copies had already drifted in length before anyone
      compared them.
- [x] 4b.2 `inferEntry` now lives in `genai/layers.js` beside `orderFromImports`,
      which is what it feeds, and reuses `resolveSpec` instead of carrying its own
      path normalisation. Both former copies had their own.
- [x] 4b.3 `discover` lives in `skill/scripts/paths.mjs`. It is filesystem work, so
      it does not belong in `genai/`, which is string-only because that is what the
      MCP server imports — a server handed stylesheets over the wire has no
      directory to walk.

## 5. Verify

- [x] 5.1 Full suite: 78 MCP, 17 discovery, 11 cascade-diff, 9 probe-theme,
      7 verify-cascade, plus the new runners.
- [x] 5.2 `largen verify` both with and without `--entry`; `contract --check` and
      `releases --check` clean.
- [x] 5.3 Regenerate the contract and pages — the command list and any derived count
      changes, and `contract --check` is what notices if they are not.
- [x] 5.4 Bump the version. Shipped files change, so `largen release` records a new
      digest and refuses to freeze while any generated surface is stale.
- [x] 5.5 Deploy, then re-run the suites against the deployed origin.
