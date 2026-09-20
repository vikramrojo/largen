# Proposal

## Why

largen's component side is machine-readable — `genai/manifest.json` is the
source and `largen gen` derives `schema.json`, `prompt.md` and `manifest.js` —
but the token side is not. The ~60 custom properties in `src/tokens.css` that a
theme is allowed to set have no JSON form, so a designer's Figma variables or
Tokens Studio export cannot become a largen theme without someone hand-writing
CSS, nothing validates a theme (whether every tone has its `-on` pair, or
whether `--space-*` stayed in rem, is checked by eye), and the tooling that
ingests W3C Design Tokens Community Group (DTCG) JSON — Style Dictionary, Figma,
Penpot, Supernova — cannot ingest largen's vocabulary. The vocabulary is
deliberately closed ("a theme sets these and nothing else"), which is exactly
what makes a JSON layer cheap to build: the mapping is a fixed table, and
validation is where the value is.

The one real consumer theme available to read, exe's `exe.theme.css` (250
lines, light + dark + OS preference, 27 vocabulary tokens plus 40-odd project
extras), grounds every decision below. The source for this proposal is
`openspec/assets/dtcg-token-layer.md`.

## What Changes

- **NEW** A DTCG document shape for largen's token vocabulary: every token in
  `src/tokens.css` has a DTCG `$type` (`color`, `dimension`, `duration`,
  `fontFamily`, `fontWeight`, `number`, `shadow`); tone pairs become groups
  (`tone.primary.$root` / `tone.primary.on`) so the pair constraint is
  structural; `--tone`/`--tone-contrast` become aliases of the neutral tone;
  `--lift-*` reference `{shade}` so a theme that moves `shade` moves the
  shadows, as `themes/dark.css` relies on today. Nothing in the vocabulary
  needs an escape hatch.
- **NEW** Export: `largen build` emits `dist/largen.tokens.json` (the defaults,
  full vocabulary) and `dist/theme-dark.tokens.json` (partial, mirroring
  `themes/dark.css`), recorded in `dist/build.json` like every other artifact
  and shipped in the package.
- **NEW** Import: `largen theme <file.tokens.json>` validates a DTCG document
  against the vocabulary and emits a `@layer largen.tokens` theme stylesheet.
  DTCG becomes the theme interchange format. Errors: a vocabulary token with
  the wrong `$type` (under `--strict`; a warning otherwise), a tone with one
  half, a `space.*` dimension not in rem, an unresolvable or cyclic reference,
  a token with neither `$value` nor a raw-CSS extension, an extra whose
  flattened name collides with a registered slot (`--bg`, `--pad`, `--radius`
  …), and a malformed name. Options: `--out`, `--theme <name>` (the
  `[data-theme]` selector), `--scheme-media` (also emit the
  `prefers-color-scheme` block, so a dark document is written once and not
  twice), `--unlayered`, `--strict`.
- **NEW** Project extras: a theme document may carry any DTCG-valid token
  outside the vocabulary; it is emitted verbatim as `--<flattened.path>`. One
  escape hatch, `$extensions["dev.largen"].css`, carries a raw CSS value
  (`clamp(…)`, `color-mix(…)`) that DTCG cannot type; `$value` is then an
  optional fallback for other tools.
- **NEW** Drift guard: `largen verify`, in the library repo, asserts that the
  vocabulary table covers `src/tokens.css` exactly, that exporting the CSS and
  importing the result reproduces the same declarations, and that
  `dist/*.tokens.json` — when present — matches the CSS. CSS stays the source
  of truth; the JSON cannot go stale silently.
- **MODIFIED** `largen verify`'s library-invariant set and `largen build`'s
  profile list grow; the CLI's command table gains `theme`; `package.json`
  `files` gains the new script and the two dist documents; README and
  SKILL.md's tooling lists gain the command.
- **Supersedes** Part 2 of the in-flight `ds-check-followups` change (its
  tasks 4.1–4.4 and its `design-tokens` delta, "DTCG export" as
  `largen tokens --dtcg`). That design inferred `$type` from value syntax and
  promised that a token added to the source appears in the export with no
  export-side edit. This change replaces inference with a declared vocabulary
  table, because the table is what validation needs; the "no silent omission"
  guarantee is kept by `verify` failing, by name, on any token the table does
  not cover. Part 1 of `ds-check-followups` (0.5.3) is untouched.

Not a build step: the library remains plain CSS. `largen theme` is a
convenience for consumers who author in a token tool; a hand-written theme is
still a valid theme.

## Capabilities

### New Capabilities

- `token-interchange`: the DTCG document shape for largen's vocabulary, the
  export of the defaults and shipped themes, the import and validation of a
  theme document into a theme stylesheet, and the guard that keeps the JSON
  equal to the CSS.

### Modified Capabilities

- `design-tokens`: the vocabulary becomes enumerable and typed — a declared
  table names every themeable token, its DTCG type, and its structural rules
  (tone pairs, rem-only space), and the table is checked against
  `src/tokens.css`. The theme contract gains the pair rule: a theme that sets
  a tone sets both halves.
- `distribution`: the optional-tooling command list gains `theme`, and
  `build`'s artifacts gain the token documents.

## Impact

- `genai/tokens.js` (new, string-only so the MCP server can import it later):
  the vocabulary table, the CSS-to-DTCG parser, the DTCG-to-CSS emitter, and
  the validator.
- `skill/scripts/theme.mjs` (new): the `largen theme` command. Named in
  `package.json` `files`.
- `skill/scripts/build.mjs`: two more profiles, JSON rather than CSS, with a
  `sha256`/`integrity` entry each in `build.json`.
- `skill/scripts/verify.mjs`: three new library invariants.
- `skill/scripts/cli.mjs`: `theme` in the command table.
- `package.json`: `files` gains `skill/scripts/theme.mjs`,
  `dist/largen.tokens.json`, `dist/theme-dark.tokens.json`; `exports` gains
  `./tokens` → `./genai/tokens.js`.
- `site/test/`: fixtures for the exe cases (extras, raw-CSS escape, retyped
  `line-height-base`, `--scheme-media`, zero radius, slot collision) and the
  round-trip assertion.
- Docs: README tooling list, SKILL.md command list, a RELEASES entry. New
  promised surface, so it rides a minor (0.6.0), replacing the 0.6.0 export
  planned in `ds-check-followups`.
- Zero third-party code, as everywhere in largen: the DTCG parser and the CSS
  token parser are hand-written for a closed vocabulary.
