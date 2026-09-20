# The 0.6.0 release entry

RELEASES.md is generated from `genai/releases.json` by `largen contract`, and
every entry is checked against the bytes that version actually shipped, frozen
at `site/public/v/<version>/`. So the entry cannot be written here: an entry for
an unreleased version would be overwritten by the next `largen contract` run and
would fail `largen releases --check`, which has no frozen 0.6.0 to check it
against. The JSON record is the release step's job (`ds-check-followups` task
5.3, and this change's own release task). This file is the text for it.

`signals` carries no new `present` string: 0.6.0 changes no CSS, so the frozen
`largen.css` is byte-identical to 0.5.3's apart from the version in its banner.
Copy 0.5.2's signals forward, as 0.5.1 and 0.5.0 did.

---

## 0.6.0 — unreleased

The token vocabulary becomes a document. `largen build` exports
`dist/largen.tokens.json` (the defaults) and `dist/theme-dark.tokens.json` (the
dark theme) as W3C Design Tokens Community Group JSON, and `largen theme` reads
a document back the other way, validating it against the vocabulary before it
emits a theme stylesheet. DTCG is now largen's theme interchange format, so a
theme can travel to Figma, Tokens Studio, Style Dictionary or Penpot and back.
No CSS change: the build id stays `0073498a`.

### Added

- `dist/largen.tokens.json` and `dist/theme-dark.tokens.json`, recorded in
  `dist/build.json` with `sha256` and `integrity` like the stylesheets and
  shipped in the package. They carry no banner — a comment is not JSON — so
  their provenance is in `$extensions["dev.largen"]`: the library version, the
  `largen.css` build id, the DTCG draft, the theme name and the colour scheme.
- `genai/tokens.js`, exported as `largen/tokens`: the vocabulary table, the CSS
  token parser, the DTCG exporter, the validator and the stylesheet emitter.
  String-only, like everything in `genai/`, so the MCP server can import it.
- The vocabulary is now declared rather than implied. Every token a theme may
  set has a DTCG `$type`; tone pairs are groups (`tone.primary.$root` /
  `tone.primary.on`), so "a theme that sets a tone sets both halves" is
  structural rather than a sentence in a comment; `--tone`/`--tone-contrast`
  are references to the neutral pair, and `--lift-*` reference `{shade}`, which
  is how the dark theme moves the shadows by moving one colour.

### Tooling

- `largen theme <file.tokens.json> [--out] [--theme] [--scheme-media]
  [--unlayered] [--strict]`. It validates first and writes nothing on an error:
  a tone with one half, a `space.*` that is not in rem, a reference that does
  not resolve or resolves in a cycle, a token with neither `$value` nor the
  `$extensions["dev.largen"].css` escape, a `$value` that fails its type, and an
  extra whose flattened name collides with a registered slot like `--pad`. A
  vocabulary token supplied with the wrong `$type` warns and is emitted anyway;
  `--strict` makes that an error. `--scheme-media` writes the
  `prefers-color-scheme` block from the same document instead of having you
  write those declarations twice.
- A document may carry project extras outside the vocabulary; each is emitted
  as `--<flattened.path>`. One escape hatch, `$extensions["dev.largen"].css`,
  carries a raw CSS value that DTCG cannot type (`clamp()`, `color-mix()`),
  with `$value` as an optional fallback for other tools.
- `largen verify` gains three library invariants: the vocabulary covers
  `src/tokens.css` exactly in both directions, naming any mismatch; exporting
  the CSS and importing the result reproduces the same declarations; and the
  built documents equal a fresh export when `dist/` is present, reported as
  NOT RUN when it is not. The CSS stays the source of truth and the JSON cannot
  go stale silently.

### The format promise

The shape of the emitted JSON is a promised surface: downstream pipelines read
it, so a change to it rides a minor release and is recorded here, never a
patch. The DTCG draft each document targets is named in the document itself
(`$extensions["dev.largen"].dtcg`, currently `2025.10`), so a later migration
knows what it is reading — the draft says of itself "do not attempt to
implement this version", and the colour object and `$root` are both recent.
Import keeps accepting the pinned snapshot.
