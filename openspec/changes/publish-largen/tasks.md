## 1. Fill the reference set's gaps

- [x] 1.1 Add `field`, `field-label`, `field-hint`, `field-error` to `components/reference.css` — the largest gap, and the one an ordinary form makes obvious
- [x] 1.2 Add `table-wrap`, `toolbar`, `empty`, `empty-title`, `empty-note`
- [x] 1.3 Theme `<progress>` and `<meter>` in `src/elements.css`, not in the reference set — they are bare elements and the fifth rule applies
- [x] 1.4 Confirm `field-error` setting `--tone: var(--danger)` passes the linter; it is the pattern the raw-semantic-token rule wrongly rejected before it was fixed
- [x] 1.5 Add the nine components to `genai/manifest.json` and re-run `largen gen`, or the MCP catalogue drifts from the stylesheet
- [x] 1.6 `largen verify` and `check_component_css` clean on the whole reference set

## 2. Show the components

- [x] 2.1 Extract `buildSourceMap()` from `site/mcp/tools/index.mjs` into `site/mcp/source.mjs`; import it from both the tool and the page generator
- [x] 2.2 Write `components/examples.js` — one spec node per component, in the generative-UI format
- [x] 2.3 Validate every example against the manifest at generation time and fail on an unknown component, so the page cannot render something the server would reject
- [x] 2.4 Regenerate `/docs/components.html`: each component rendered, with its source and the axes it responds to
- [x] 2.5 Confirm the count on the page equals the manifest count — a component missing an example must be visible, not silently skipped
- [x] 2.6 **Screenshot the page in both themes and read it.** The page it replaces rendered nothing at all and returned 200 doing it

## 3. Make the CLI work when installed

- [x] 3.1 Convert `cli.mjs` dispatch to lazy dynamic import, so an unpublished command does not break the whole CLI at load
- [x] 3.2 Report a missing repository-only command as such, rather than as a module resolution error
- [x] 3.3 Split `verify.mjs`: library invariants run only when the package root is the working directory
- [x] 3.4 `largen verify [css...]` lints the caller's files, resolved from the working directory, and prints what it scanned
- [x] 3.5 Drop `manifest.mjs`'s import of `site/mcp/contract.mjs` in favour of `registeredSlots()` from `genai/lint.js` — the last `site/` dependency in a consumer-facing command
- [x] 3.6 Have `build` name `lightningcss` when it is absent

## 4. Package and repository

- [x] 4.1 Replace wholesale `files[]` entries with an explicit list; nothing that only serves the repository
- [x] 4.2 Add `repository`, `homepage`, `bugs`, `keywords`, and `"./package.json"` to `exports`
- [x] 4.3 Write `LICENSE` (MIT), which `package.json` has been claiming without one present
- [x] 4.4 Update `README.md` and the `COMMANDS` list in `site/mcp/contract.mjs` — the latter feeds `SKILL.md`, so the advertised commands regenerate from one source
- [ ] 4.5 First git commit, then the remote

## 6. Remove the build dependency

- [x] 6.1 Write `skill/scripts/bundle.mjs` — inline imports, strip comments, collapse whitespace, no dependencies
- [x] 6.2 Handle comments and strings in one ordered pass; largen's comments are prose full of apostrophes, and a string-first scanner leaves every comment in place
- [x] 6.3 Never trim whitespace around `:` or a combinator — `.prose :is(h1,h2)` must not become `.prose:is(h1,h2)`
- [x] 6.4 Drop `lightningcss` from `package.json`; the root package now has no dependencies of any kind
- [x] 6.5 Delete both root lockfiles — `package-lock.json` and `pnpm-lock.yaml` were both tracked, for one package
- [x] 6.6 Drop the root `npm ci` from `deploy.sh`; the VM no longer downloads a native binary per deploy
- [x] 6.7 Document lightningcss as an optional tool for a project's own stylesheet, in README and the contract's commands caveat
- [x] 6.8 Record the measured cost and confirm the mechanism survives — see §7

## 7. Verification of the bundler

- [x] 7.1 `demo/conformance.html` against the built bundle, not just the source — the mechanism has no fallback and nothing else would catch a mangled selector
- [x] 7.2 Diff old against new `dist/` and account for every difference
- [x] 7.3 Build from a checkout with no `node_modules` present
- [x] 7.4 `npm pack` after `rm -rf dist` still ships all three dist files via `prepack`
- [x] 7.5 Screenshot the site in both themes and compare against the lightningcss build
- [x] 7.6 `largen verify` no longer reports `--lightningcss-*` as unregistered slots
- [x] 7.7 Full suite locally and against the deployed site
- [x] 7.8 A VM deploy with no root install in the path

## 8. Integration findings from the field

Reported from an Astro + Tailwind integration; none of it caught by astro check,
the build, or `largen verify`.

- [x] 8.1 Stop `largen.elements` bordering the last table row — it doubled against any enclosing border and shifted everything below by 1px. Measured 127px to 126px on a wrapped table
- [x] 8.2 Same fix for `.doc-table` on the site, which had the identical trailing line
- [x] 8.3 Add a failure mode for layer position: a layer is fixed at first mention, a sublayer inherits its parent's, so a consumer's layers land after largen whatever their `@layer` statement says
- [x] 8.4 Give it the actionable form — one statement before largen, flat names on both sides — and verify the published snippet actually interleaves before shipping it
- [x] 8.5 Document Tailwind coexistence in MIGRATING: where a preflight has to sort, why flat names, and reading compiled output rather than the utility name
- [x] 8.6 Record that the migration's `!important`s were not load-bearing

## 5. Verification

- [x] 5.1 `npm pack --dry-run` — the file list is exactly the intended set, with no `pages.mjs`, `contract.mjs`, `markdown.mjs` or `site-example.css`
- [x] 5.2 **Install the tarball into a scratch project and run it there.** This is the check that would have caught every packaging defect, and no existing assertion touches it
- [x] 5.3 In that project: `npx largen verify ./their.css` reports on their file and not on largen's
- [x] 5.4 In that project: import every published entry point — `largen/validate`, `largen/lint`, `largen`, `largen/components` — so a missing `files[]` entry fails loudly
- [x] 5.5 In that project: a repository-only command reports its message rather than a stack trace
- [x] 5.6 `largen verify` in-repo still runs the invariants and passes
- [x] 5.7 `largen contract --check`, `largen pages`, `largen release` still work in-repo
- [x] 5.8 Full suite locally and against the deployed site; the `list_components` fallback assertion checks names rather than a count, so it survives the additions
- [x] 5.9 `openspec validate publish-largen`
