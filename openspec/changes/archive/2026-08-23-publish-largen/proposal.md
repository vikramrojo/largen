# Publish largen

## Why

largen works and is deployed, but nobody else can pick it up. Three things stand
between it and a public repository, and they are related closely enough to do at
once — the first changes what the third ships.

**The reference component set does not present itself.** `components/reference.css`
carries 24 components, and `src/elements.css` already themes bare `<button>`,
`<input>`, `<select>`, `<textarea>`, `<table>`, `<dialog>`, `<details>`, `<a>`, `<hr>`
and `<code>` — so the ready-to-use surface is larger than the component count suggests,
and there is deliberately no `.button`. But `/docs/components.html` is a table of 23
names that renders **zero** components, and the demo page that did render them was
deleted in an earlier cleanup on the mistaken grounds that the docs page covered it.
There is currently no page anywhere that shows a reference component.

**The set has real gaps.** Forms above all — no grouping of label, control, hint and
error — plus a table overflow wrapper, a toolbar, an empty state, and `<progress>` and
`<meter>` going unthemed while every other bare control is themed.

**The npm package would ship broken.** Measured, not assumed:

- `skill/scripts/paths.mjs` resolves to the *package* root, so `npx largen verify` in a
  consumer's project checks largen's own CSS rather than theirs, silently. That is the
  command `skill/SKILL.md` and `README.md` both advertise.
- `verify` asserts `demo/conformance.html` exists, which `files[]` does not ship.
- `contract`, `manifest`, `pages` and `release` import `site/`, which is not published.
  `manifest` is the command the MCP documentation tells agents to run.
- `files: ["skill"]` and `["dist"]` are wholesale, so the package would carry
  `pages.mjs` (18.4kB, containing largen.dev's landing-page copy), `contract.mjs`
  (15.5kB), `markdown.mjs`, and `dist/site-example.css` (15.3kB).

Of seven CLI commands, only `gen` works from an installed copy. There is also no
`LICENSE` file despite `package.json` declaring MIT, no `repository`, `homepage` or
`keywords`, and no git history at all.

## What Changes

- **NEW** Nine components filling the set's real gaps — `field`, `field-label`,
  `field-hint`, `field-error`, `table-wrap`, `toolbar`, `empty`, `empty-title`,
  `empty-note` — plus `<progress>` and `<meter>` themed in `src/elements.css`, since
  they are bare elements and the contract says reach for HTML first.
- **NEW** A components page that shows each component **rendered, in both themes, with
  its source beside it**. One artifact serving as catalogue, worked example and copy
  source at once. Examples are expressed as generative-UI spec nodes and rendered
  through the same validator and renderer the MCP server uses, so an example naming a
  component absent from the manifest fails at generation time rather than rendering
  wrongly.
- **NEW** A published npm package whose contents are declared explicitly rather than by
  directory, carrying the library, the two importable JS modules, and only the CLI
  commands that work when installed.
- **BREAKING** `largen verify` changes meaning for a consumer: it lints **their** files,
  passed as arguments or discovered from the working directory, instead of largen's own
  source. The library invariants it used to run move behind a separate path that only
  applies when developing largen itself.

## Capabilities

### New Capabilities

- `component-library` — the reference set as simultaneously a worked example and
  something shippable: what it must cover, how it is presented, and the copy-in model
  that keeps it from becoming an API
- `package-distribution` — what the npm package contains, what the CLI does when
  installed elsewhere, and the repository metadata a public project needs

### Modified Capabilities

None expressed as deltas. `openspec/specs/` is empty because neither `build-largen` nor
`largen-dev-site` is archived, so there is no baseline to write against — the same
situation `largen-dev-site` recorded, and the same resolution.

The relationships are real and worth stating:

- `build-largen`'s **`distribution`** capability requires that the CLI provide `build`,
  `verify` and `gen` and that none be required to use the library. That still holds. It
  does not say what the package contains, nor that `verify` operates on the consumer's
  components, and both gaps are why the package would ship broken. `package-distribution`
  supersedes its "Optional tooling" requirement.
- `build-largen`'s **`component-authoring`** capability governs how a component is
  written. The nine new components obey it unchanged; `component-library` is about what
  the set covers and how it is shown, not how a component is authored.
- `largen-dev-site`'s **`documentation-site`** capability requires the site be static
  HTML built with largen. The components page continues to satisfy it.

## Impact

- `src/elements.css` gains two element rules, which changes the core stylesheet and
  therefore `dist/largen.css`. Everything else in `src/` is untouched.
- `genai/manifest.json` gains nine components, so the MCP catalogue and the generated
  schema and prompt all grow. Specs naming the new components become valid.
- Consumers of `largen verify` see different behaviour. There are none yet, which is
  why this is the moment to change it.
- `package.json` `files[]` becomes an explicit list. Anything added to `skill/scripts/`
  in future will not ship unless it is named, which is the intended direction.
- No change to the copy-in model. `get_component_source` and the framing that largen
  ships an algebra rather than a dependency are what reconcile *example* with *ready to
  use*, and they already work.
