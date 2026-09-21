# Design

## Context

See proposal.md for motivation. What shapes the approach:

- `src/tokens.css` is ~60 custom properties inside `@layer largen.tokens`, in
  irregular names (`--ink-muted`, `--hue-red`, `--text-base`,
  `--line-height-base`). `themes/dark.css` overrides eleven groups of them and
  inherits the rest. Two declarations are already references
  (`--tone: var(--neutral)`, `--tone-contrast: var(--neutral-on)`) and two
  contain references (`--lift-*` use `var(--shade*)`).
- The DTCG draft (2025.10) says of itself "do not attempt to implement this
  version". The colour object (`colorSpace` + `components` + optional `hex`)
  and `$root` are both recent.
- `genai/` is string-only by rule: those modules are what the MCP server
  imports, and a server receiving documents over the wire has no filesystem.
  Filesystem work lives in `skill/scripts/`.
- The precedent runs the other way: `genai/manifest.json` is the source and
  the CSS-facing artifacts are derived. `largen gen` refuses hand-edits to
  `schema.json` by regenerating it.
- `largen verify` distinguishes contract checks (the caller's files) from
  library invariants (only when the package root is the working directory)
  and reports checks it could not run as NOT RUN rather than guessing.
- The in-flight `ds-check-followups` change planned a DTCG export for 0.6.0 as
  `largen tokens --dtcg`, `$type` inferred from value syntax, no import.
- The only non-trivial consumer theme readable today is exe's
  `exe.theme.css`; eight of its lines are the cases the validator is designed
  around (see `openspec/assets/dtcg-token-layer.md`, "What exe taught us").

## Goals / Non-Goals

**Goals:**

- One vocabulary table that the exporter, the importer, the validator and
  `verify` all read, so the four cannot disagree.
- An exact round trip: import(export(`src/tokens.css`)) reproduces the same
  declarations, name for name and value for value.
- Validation that catches the mistakes exe's theme could have made and did
  not: a half tone, a pixel space, a slot collision, a typo passed through.
- Zero third-party code, like the bundler.

**Non-Goals:**

- Slot and algebra tokens (`--bg`, `--pad`, `--tone-soft`). They are derived
  or per-component, not themeable, and the vocabulary excludes them.
- `$extends` or any mode machinery. A theme is a partial document; the subset
  rule gives the same guarantee without a resolver.
- Per-component tokens.
- Resolving CSS expressions (`color-mix()`, `clamp()`) to literals. That is a
  browser's job; `largen probe` is the answer, as `ds-check-followups` already
  concluded.
- Tokens Studio's pre-DTCG dialect (`value`/`type` without `$`). Later, if
  asked for.

## Decisions

**D1. CSS stays the source of truth; JSON is derived.** The reverse of the
manifest precedent, on purpose. The draft is unstable, so the generated side
should be the one that is cheap to regenerate when the format moves.
`largen build` exports; `largen verify` guards. Flip later if the format
settles. *Alternative:* JSON as source with `tokens.css` generated — rejected
because it would make the stylesheet depend on a draft format and on a build
step, and the no-build-step requirement is the library's first sentence.

**D2. A declared vocabulary table, not type inference.** `genai/tokens.js`
exports a table: for each token, its custom-property name, its DTCG path, its
`$type`, and any structural rule (member of a tone pair, alias target,
unit constraint). The exporter walks the table; the importer checks against it;
`verify` asserts the table and `src/tokens.css` name exactly the same set.
This supersedes `ds-check-followups`' inference design. Inference was the
right call for "export whatever is there"; it is the wrong call for
validation, which needs to know that `line-height-base` is a `number` even
when a consumer supplies a `dimension`. The guarantee inference gave — a
token added to the CSS cannot be silently dropped — is kept, as a `verify`
failure that names the token. *Alternative:* infer and validate loosely —
rejected; a validator that learns the vocabulary from the file it validates
validates nothing.

**D3. Where the code lives.** `genai/tokens.js`: vocabulary, `parseTokensCss`
(CSS text → flat name/value map, with the reference forms preserved),
`toDtcg` (map → document), `fromDtcg` (document → validated map + diagnostics),
`toThemeCss` (map + options → stylesheet). String in, string out, no imports
from `node:fs`. `skill/scripts/theme.mjs`: arguments, file I/O, exit codes.
`build.mjs` and `verify.mjs` import the same module. The `genai` directory is
already in `files`, so nothing new needs listing there; `theme.mjs` does.

**D4. Names flatten by table, extras flatten by rule.** largen's names are
irregular, so each vocabulary entry carries both its DTCG path and its custom
property explicitly (`tone.primary.on` ↔ `--primary-on`; `default-tone.$root`
↔ `--tone`). Extras have no table entry and flatten by joining the path with
`-` (`text.display` → `--text-display`), which is what exe already writes.
A `$root` member contributes nothing to the flattened name.

**D5. Colour: emit both forms, accept either, hex is authoritative.** The
export writes sRGB `components` rounded to four decimals and the `hex` string;
`alpha` only when the CSS value carried one. Import accepts a colour with
`hex` alone or `components` alone; when both are present they must agree to
within rounding, else error. Emission prefers `hex` when present so the round
trip is byte-exact and does not depend on float formatting. `rgba()` is
emitted whenever `alpha` < 1, matching the CSS. *Alternative:* components
only, per the draft's direction — rejected for now; a hex string is what every
tool and every human reads, and the draft still allows it.

**D6. Tone pairs use `$root`.** `tone.primary.$root` is the tone,
`tone.primary.on` its contrast. The pair rule is then a structural check: a
`tone.<name>` group must have both members or neither. `$root` is new in the
draft; if it moves, the fallback shape is `tone.primary.value` + `on`, and
the importer can accept both under a later minor. Pinned via the `dtcg` field
in `$extensions`.

**D7. `--neutral` is a literal; `--tone` is an alias.** The source document
asked whether `--neutral` should be exported as `{ink}`. The evidence says
no: in `themes/dark.css`, `--ink` is `#f2f4f6` and `--neutral` is `#e6e9ec`.
Same hex in light is coincidence, and an alias would be a claim the CSS does
not make. `--tone`/`--tone-contrast` are `var(--neutral)`/`var(--neutral-on)`
in the CSS, so they are references in the JSON. `--lift-*` contain
`var(--shade)`/`var(--shade-strong)`, so their `color` is a reference, which
is what lets the dark theme move the shadows by moving `shade`. Rule: a
reference in JSON exists exactly where a `var()` exists in the CSS. The parser
keeps `var()` forms distinct from literals so the exporter never has to guess.

**D8. `line-height-base` stays a `number`; a retype warns.** exe aliases it to
a rem dimension, which is valid CSS and an invalid DTCG alias. The vocabulary
declares one type. Import warns (token, declared type, supplied type), emits
the value, and `--strict` turns the warning into an error. This is the
decision the source document asked largen to make explicitly, and it is made
as: the retype is off-contract but tolerated, so that a real theme still
converts. *Alternative:* declare `number | dimension` — rejected; a union
type is a promise about `line-height` semantics the algebra does not make.

**D9. A slot collision is an error, not a warning.** The `design-tokens` spec
already says a token name must not match a registered slot, because the
universal paint rule would read it. The importer takes the registered slot
names from `src/properties.css` (via `registeredSlots` in `genai/lint.js`,
already string-only) plus the derived tone family (`--tone-soft`, `--tone-ink`,
`--tone-line`) and `--scale`, and rejects any extra that flattens to one of
them. *Alternative:* warn — rejected; the failure is silent and total, which
is the class of failure `verify` exists to refuse.

**D10. Layered by default; `--unlayered` opts out; the header says which.**
Both shipped themes are layered, and `themes/dark.css`'s header records the
asymmetry bug that unlayered themes caused. exe chose unlayered to win
regardless of link order; that stays available and stays labelled.

**D11. One dark document, two selectors.** `--scheme-media` emits the
`[data-theme="dark"]` block and, inside the same layer, a
`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }`
block with identical declarations. exe wrote those 22 declarations twice by
hand; the generator writes them once.

**D12. Units are preserved, never normalised.** `--speed: 0.12s` exports as
`{ value: 0.12, unit: "s" }`, not `120 ms`. A zero length exports as
`{ value: 0, unit: "rem" }` (DTCG requires a unit) and imports back as a bare
`0`. Round-trip exactness is the invariant `verify` checks, and normalisation
would make that check harder for no consumer benefit.

**D13. Hues are in the vocabulary.** Themes are partial by construction, so a
theme that sets no hue (exe) and one that sets all fourteen (`dark`) are both
valid, and the question of whether hues are "optional" dissolves.

**D14. `space.*` must be rem.** An error, not a warning. `tokens.css` spends
twenty lines on why; the check is one line and is the single most valuable
one in the layer.

**D15. Build integration.** Two more entries in `build.mjs`'s profile list,
distinguished by kind: JSON profiles run the exporter instead of the bundler,
carry no banner (a comment would break JSON; the provenance lives in
`$extensions["dev.largen"]` with the library version and the `largen.css`
build id), and are recorded in `build.json` with `sha256` and `integrity` like
the stylesheets. Naming follows the existing `theme-dark.css`:
`theme-dark.tokens.json`. `themes/light.css` is not exported — it restates the
defaults, and a second document with the same values is a second thing to
drift.

**D16. The `verify` invariants.** Three, in the library-invariant block:
(1) vocabulary ↔ `src/tokens.css` coverage, both directions, naming any
mismatch; (2) round trip — parse the CSS, export, import, compare the two
name/value maps; (3) `dist/*.tokens.json` equals a fresh export, reported as
NOT RUN when `dist/` is absent, matching how the cascade checks report a
missing entry. The theme files are covered by (3) and by a variant of (2) run
on `themes/dark.css`.

**D17. Sequencing.** New promised surface, so it ships in 0.6.0. It replaces
the 0.6.0 export in `ds-check-followups` Part 2; that change's tasks 4.1–4.4
and its `design-tokens` delta should be struck when this change is applied,
and its Part 2 lint promotion is unaffected. Part 1 (0.5.3) ships first, as
already planned.

## Risks / Trade-offs

- [The DTCG colour object or `$root` changes shape] → the `dtcg` snapshot is
  pinned in every document; import accepts the pinned shape indefinitely;
  a shape change is a minor release with a RELEASES entry. Hex is kept so the
  most likely change (components-only) does not lose information.
- [A consumer's document uses Tokens Studio's `value`/`type` dialect] →
  rejected with a message naming the `$`-prefixed keys DTCG requires. Support
  is a later, additive change.
- [The vocabulary table and the CSS drift] → `verify` invariant (1) fails by
  name in both directions. This is the whole reason the table is declared
  rather than inferred.
- [Emitted CSS differs subtly from what a person writes and confuses diffing
  against a hand-written theme] → the emitter targets the authored forms (hex,
  `rgba()`, bare `0`, rem) and the round-trip check on `src/tokens.css` and
  `themes/dark.css` proves it reproduces both files' declarations.
- [The retype warning is noisy for a real theme] → `--strict` is opt-in; the
  default path warns once per token and still emits.
- [Slot-collision check depends on `properties.css` being readable] → in the
  package it always is; the importer receives the slot list as an argument so
  the string-only module never reads a file.
- [Adding JSON profiles complicates `build.mjs`] → the profile tuple gains a
  kind; the loop branches once. No third-party code either way.

## Migration Plan

1. Land behind no flag; nothing in `src/*.css` changes, so the `largen.css`
   build id must not move (the release check would fail if it did).
2. `largen build` produces the two documents; `largen verify` goes green with
   the three new invariants; the install test confirms `npx largen theme`
   runs from a packed tarball.
3. Strike `ds-check-followups` tasks 4.1–4.4 and its `design-tokens` delta,
   citing this change.
4. RELEASES entry and README/SKILL.md tooling lines; publish 0.6.0 after
   0.5.3.
5. Rollback: a normal npm release; a bad 0.6.0 is superseded, not unpublished.
   Consumers who never run the CLI are unaffected in every case.

## Open Questions

- Whether the MCP server should expose the validator as a tool
  (`validate_theme_document`). The module is string-only so it can; deferred
  until a hosted agent needs it.
- Whether `largen theme` should accept several documents and merge them
  (light + dark + extras from one design file). Deferred; the subset rule
  makes a merge well-defined, so it is additive.
- Whether `$description` strings should be carried from `tokens.css` comments
  into the export. Nice for Figma; needs a comment convention first.
