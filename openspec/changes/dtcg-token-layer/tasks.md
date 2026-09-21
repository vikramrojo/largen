# Tasks

## 1. The vocabulary and the parsers (`genai/tokens.js`, string-only)

- [x] 1.1 Declare the vocabulary table: one entry per token in
      `src/tokens.css` with custom-property name, DTCG path, `$type`, and
      structural rule (tone-pair member, alias target, `rem`-only). Verify: a
      quick script lists the table's property names and diffs them against
      `grep -o -- '--[a-z0-9-]*:' src/tokens.css`; the diff is empty.
- [x] 1.2 `parseTokensCss(css)`: the `@layer largen.tokens { <selector> { … } }`
      block → ordered `Map<name, value>` plus `colorScheme` and the selector,
      with `var(--x)` forms kept distinct from literals. Verify: parsing
      `src/tokens.css` yields every vocabulary name and `--tone` is recorded
      as a reference to `--neutral`; parsing `themes/dark.css` yields exactly
      its declarations and selector `[data-theme="dark"]`.
- [x] 1.3 Value codecs, both directions: hex ↔ colour object (components to 4
      decimals, hex kept); `rgba()` ↔ colour with `alpha`; `<n><unit>` ↔
      dimension/duration with the unit as authored; `0` ↔ `{0, rem}`; font
      stack ↔ array (quotes stripped and restored only where needed); number;
      font weight; `0 1px 2px var(--shade)` ↔ shadow with a `{shade}`
      reference. Verify: a table-driven test round-trips every value in
      `src/tokens.css` and `themes/dark.css` back to the identical string.
- [x] 1.4 `toDtcg(map, meta)`: build the document from the table — groups,
      `$root`/`on` pairs, aliases where the CSS had `var()`, `$description`
      on the groups, `$extensions["dev.largen"]` with `version`, `build`,
      `dtcg: "2025.10"`, `colorScheme`, and `theme` when given. Verify: the
      defaults export contains every vocabulary path with `$type` and
      `$value`; `default-tone.$root.$value` is `"{tone.neutral.$root}"`;
      `lift.1.$value.color` is `"{shade}"`; `tone.neutral.$root` is a literal
      (D7).
- [x] 1.5 `fromDtcg(doc, { slots })`: walk groups (inheriting `$type`),
      resolve references with cycle detection, validate every token, and
      return `{ map, colorScheme, theme, errors, warnings }`. Errors: bad
      name, unresolved/cyclic reference, no `$value` and no
      `$extensions["dev.largen"].css`, `$value` fails its `$type` codec,
      `space.*` unit ≠ rem, half a tone, extra flattens to a slot or derived
      tone name. Warning: vocabulary token retyped. Every diagnostic names the
      path. Verify: one fixture per rule under `site/test/fixtures/tokens/`,
      each asserted to produce exactly its diagnostic and nothing else.
- [x] 1.6 `toThemeCss(map, { theme, colorScheme, layered, schemeMedia,
      header })`: emit hex for opaque, `rgba()` for translucent, bare `0`,
      units as given, raw-CSS extension verbatim; `@layer largen.tokens`
      wrapper unless unlayered; the media block when asked; the generated
      header naming command, version, DTCG snapshot and layering. Verify:
      importing the exported defaults and re-parsing with `parseTokensCss`
      gives a map equal to parsing `src/tokens.css` directly (the round
      trip); the `--scheme-media` fixture output contains both selectors with
      identical declaration lists.

## 2. The command (`skill/scripts/theme.mjs`)

- [x] 2.1 `largen theme <file.tokens.json> [--out] [--theme] [--scheme-media]
      [--unlayered] [--strict]`: read the file, read the slot list from
      `src/properties.css` via `registeredSlots`, call `fromDtcg`, print
      warnings, exit 1 on errors (or on warnings under `--strict`) with
      nothing written, else emit to stdout or `--out`. Verify: the exe-shaped
      fixture (extras + clamp escape + retyped line-height + zero radius)
      converts with one warning and produces `--text-display: clamp(…)` and
      `--radius-sm: 0`; the half-tone fixture exits 1 and writes no file.
- [x] 2.2 Register `theme` in `cli.mjs`'s command table with a blurb; add
      `--help` text mirroring `verify`'s style. Verify: `node
      skill/scripts/cli.mjs` lists it; `largen theme --help` prints usage.

## 3. Export on build

- [x] 3.1 `build.mjs`: profiles gain a kind; JSON profiles
      (`largen.tokens.json` ← `src/tokens.css`, `theme-dark.tokens.json` ←
      `themes/dark.css`) run `parseTokensCss` + `toDtcg` with the
      `largen.css` build id as `build`, no banner, and are recorded in
      `build.json` with `bytes`, `sha256`, `integrity`. Verify: `npm run
      build` writes both files, `build.json` lists them, and the `largen.css`
      build id is unchanged from 0.5.2's `0073498a`.
- [x] 3.2 `package.json`: `files` gains `skill/scripts/theme.mjs`,
      `dist/largen.tokens.json`, `dist/theme-dark.tokens.json`; `exports`
      gains `"./tokens": "./genai/tokens.js"`. Verify: `npm pack --dry-run`
      lists all three files; `node -e "import('largen/tokens')"` resolves
      from a packed install.

## 4. The drift guard (`skill/scripts/verify.mjs`, library invariants)

- [x] 4.1 Invariant: the vocabulary covers `src/tokens.css` exactly, both
      directions, naming any mismatch. Verify: add a bogus `--foo: 1px` to a
      scratch copy of tokens.css and confirm the failure names `--foo`;
      remove a table entry and confirm the failure names it. Restore.
- [x] 4.2 Invariant: round trip — `src/tokens.css` and `themes/dark.css`
      each parse → export → import → equal maps. Verify: change one exported
      hex in a scratch build and confirm the check names the token.
- [x] 4.3 Invariant: `dist/largen.tokens.json` and `dist/theme-dark.tokens.json`
      equal a fresh export when present; reported `NOT RUN` with the reason
      when `dist/` is absent. Verify: `rm -rf dist && npm run verify` shows
      NOT RUN; `npm run build && npm run verify` shows ok; hand-editing one
      value in the dist JSON makes it fail by name.

## 5. Tests and fixtures (`site/test/`)

- [x] 5.1 Fixtures under `site/test/fixtures/tokens/`: `exe-like.tokens.json`
      (extras, clamp escape, retyped line-height, zero radius, full tone
      pairs), `half-tone.tokens.json`, `space-px.tokens.json`,
      `cycle.tokens.json`, `slot-collision.tokens.json`,
      `typo-colour.tokens.json`, `hex-only.tokens.json`,
      `components-only.tokens.json`, `both-disagree.tokens.json`. Verify:
      each file exists and is the input of exactly one assertion below.
- [x] 5.2 `site/test/tokens.mjs`: the diagnostics table from 1.5, the codec
      round-trip from 1.3, the CSS round-trip from 1.6, the `--scheme-media`
      shape, the unlayered header, and the two colour-form acceptances.
      Wire into whatever runs the suite today. Verify: the suite reports the
      new assertions and all pass; deleting the `space` rule from
      `fromDtcg` turns exactly one red.

## 6. Documentation and release

- [x] 6.1 README tooling block and SKILL.md command list gain `largen theme`
      with one line each; a short "Themes as token documents" section in
      README shows the dark excerpt and the command. Verify: `largen
      contract` regenerates cleanly if SKILL.md is generated (check
      `contract.mjs`); otherwise the edit is direct and the release check's
      shipped-file hash moves only at the bump.
- [x] 6.2 Strike `ds-check-followups` tasks 4.1–4.4 and delete its
      `specs/design-tokens/spec.md` delta, each replaced by a one-line
      pointer to this change. Verify: `openspec validate ds-check-followups` still passes.
- [x] 6.3 RELEASES.md entry for 0.6.0 naming the new surface, the DTCG
      snapshot pinned, and the shape-changes-ride-minors rule. Verify:
      `largen releases` accepts the entry once the version is bumped.

## 7. Verification

- [x] 7.1 End to end: `npm run build && npm run verify` green with three new
      `ok` lines; `node skill/scripts/cli.mjs theme dist/theme-dark.tokens.json
      --scheme-media` prints a stylesheet whose `[data-theme="dark"]`
      declarations equal `themes/dark.css`'s. Verify: diff of the two
      declaration lists is empty.
- [x] 7.2 Install test: `npm pack`, install the tarball in a scratch
      directory, run `npx largen theme <fixture>` and `npx largen build`.
      Verify: both succeed with no module-resolution error, and `build`
      reports the site-example profile as skipped, as today.
