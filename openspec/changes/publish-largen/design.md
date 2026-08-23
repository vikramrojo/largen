# Design

## Context

Everything here follows from one measured fact and one unmeasured assumption that
turned out to be wrong.

The fact: of seven CLI commands, exactly one works from an installed copy. The
assumption: that a CSS library's package boundary is obvious enough not to check. It
was not, and the failures are all of the same kind — code written for this repository
that behaves differently, or not at all, somewhere else.

The reference set has the mirror-image problem. It is written as a teaching artifact
and it is genuinely good at that, but nothing shows it working, so the claim "copy this"
requires reading CSS to evaluate.

## Goals / Non-Goals

**Goals**

- Someone can install the package and have every advertised command work.
- Someone can read one page and decide whether the reference set is worth copying.
- The set covers what an ordinary interface needs, without becoming a catalogue.

**Non-Goals**

- Making the reference components an API. They remain copy-in.
- A component for everything. The bare elements already cover most controls.
- Semantic-versioning the component set. Copied code does not have a version.

## Decisions

### 1. `verify` changes meaning rather than gaining a flag

`largen verify` currently runs two unrelated groups of checks against paths resolved
from the package root: invariants that only make sense against largen's own source
(no slot declares an `initial-value`, every painted property falls back to
`revert-layer`, layer order), and contract checks that are exactly what a consumer
wants (colour literals, tone bypass, layer membership, unregistered slots).

The consumer-facing half is already extracted into `genai/lint.js` and shipped. What is
wrong is only which files it reads.

Three options were considered:

- **A flag** — `largen verify --self` for the library. Rejected: it makes the wrong
  behaviour the default and the right behaviour opt-in, for the larger audience.
- **Two commands** — `verify` and `selftest`. Rejected as more surface than the problem
  needs, and `selftest` would be dead weight in the published package.
- **Context-sensitive** — chosen. `verify` always runs the contract checks against
  the consumer's files; it additionally runs the invariants when the package root is the
  working directory, which is true exactly when someone is developing largen.

The consequence is a behaviour change with no deprecation path. That is acceptable
because the current behaviour is not merely different but wrong — it silently reports on
files the caller did not ask about — and there are no consumers yet.

### 2. The CLI loads commands lazily

Removing `contract`, `pages` and `release` from the package while `cli.mjs` imports them
at the top would break the CLI at load rather than at use: every command would fail,
including the ones that ship. Dispatch therefore becomes a map of name to dynamic
import, and a missing module is reported as "this command is for developing largen"
rather than as a resolution error.

This is the same shape as the existing guard inside `contract.mjs`, which checks for
`site/` before doing anything. That guard was written for exactly this hazard and then
undermined by a static import above it.

### 3. Examples are specs, not markup

The components page needs example markup for each component. Writing that markup by hand
would create a third place where component names live, after the stylesheet and the
manifest, and it would drift.

Examples are therefore generative-UI specification nodes, validated by
`createValidator(manifest)` and rendered by `renderNode()` — the same two modules the
MCP server uses. An example naming a component that is not in the manifest fails at
generation time. A component whose element is wrong in the manifest renders wrong on the
page, visibly, where it would otherwise only be wrong over MCP.

The page is therefore also a test of the manifest.

### 4. Source extraction is shared, not duplicated

`get_component_source` already slices per-component CSS out of the reference
stylesheets. The page needs the same slices. Moving that function into its own module
and importing it from both places is the same reasoning that put validation in one
module: two implementations of "find this component's source" would eventually disagree,
and the disagreement would be invisible.

### 5. `<progress>` and `<meter>` go in the core, not the reference set

They are bare elements, and the contract's fifth rule says reach for HTML first. Putting
them in `reference.css` would make them optional, which would mean a project importing
only `src/largen.css` gets themed `<button>` and `<input>` but unthemed `<progress>` —
an inconsistency with no defensible line behind it.

The cost is that the core stylesheet grows. It is a few lines, and the alternative is
worse.

### 6. Nine components, chosen by absence rather than by category

The additions are the things whose absence is noticeable when building something
ordinary: a form field group, a table that scrolls, a row of controls, and an empty
state. Deliberately not added: tabs (needs behaviour), modals (`dialog` exists),
accordions (`details` exists), buttons (themed), cards beyond the existing one.

The test applied was not "what would a component library have" but "what did the example
site have to invent, and what does the documentation site itself keep re-authoring".

## Risks / Trade-offs

**Changing `verify`'s meaning is breaking.** → No consumers exist. Doing it after
publishing would be considerably worse, which is the argument for doing it now rather
than the argument that it is free.

**An explicit `files[]` will be forgotten.** → Someone adds a module, it does not ship,
and a consumer sees a resolution error. Mitigated by the install test, which imports
every published entry point; it fails loudly if something is missing.

**The manifest and the stylesheet can still drift.** → The manifest is hand-maintained
and the stylesheet is authored; nothing forces a new component into both. The components
page narrows the window — a component in the stylesheet but not the manifest has no
example and is visibly absent from the page — but does not close it.

**The reference set becoming a dependency by accident.** → Every addition makes "just
import `largen.components.css`" more attractive than copying. That is not fatal, and the
import path is supported, but the framing in the source header and on the page has to
keep saying which one is intended.

## Migration Plan

No consumers, so nothing to migrate. Order matters only in that the package contents
should be settled before the first publish, since an explicit `files[]` is easier to
widen later than to narrow.

Rollback for the package is unpublishing within the registry's window; rollback for
everything else is the repository.

## Open Questions

- Whether the package should also ship `MIGRATING.md`, or leave it to the site.
- Whether `largen verify` with no arguments should discover CSS under the working
  directory or require paths. Discovery is friendlier and can surprise; the current
  intent is to discover and print what was scanned.
