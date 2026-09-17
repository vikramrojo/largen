## Why

largen's whole mechanism hangs on `@property`: fourteen slots registered with
`inherits: false` and no `initial-value`, so an unset slot is guaranteed-invalid
and `var(--x, revert-layer)` hands the property back to the UA. An engine that
has everything else largen needs but not `@property` — Firefox 113–127
(including ESR 115) and Safari 16.2–16.3 — parses the registrations as nothing.
The slots become ordinary custom properties, they inherit, and a card's `--bg`
repaints its whole subtree. Measured on a real page: deleting the fifteen
registrations in a live tab changed 158 of 168 elements.

Tailwind v4.1 shipped the fix and it transfers exactly, because largen's slots
are registered the same way as `--tw-shadow-color`. A lowest-sorting layer
re-declares every non-inheriting slot to `initial` on every element, behind an
engine-sniff `@supports` that matches only the engines that lack `@property`.
On an unregistered custom property, `initial` *is* the guaranteed-invalid
value, so the fallback reproduces `inherits: false` per element; a component
that sets a slot still wins from any later layer. Replayed against largen's
own pages: with the registrations deleted and the fallback added, zero of 168
elements differed from the original.

The floor below stays where it is. `color-mix()` arrived in the same Safari
16.2 / Firefox 113 that the fallback extends down to, so this covers exactly
the gap where `@property` arrived last, and nothing older.

## What Changes

- **NEW** `src/fallback.css` — a `largen.fallback` layer, sorted below every
  other largen layer, containing the per-element resets and a `:root` seed for
  `--scale`, guarded by Tailwind v4.1's engine sniff. Inert in every engine
  that has `@property`.
- **MODIFIED** `src/largen.css` — the layer statement gains `largen.fallback`
  first; a new `@import` pairs the fallback with the registration it mirrors.
- **MODIFIED** `largen verify` — the expected layer order gains the eighth
  layer, and a new invariant asserts the fallback's reset set mirrors the
  `inherits: false` registrations exactly, with `--scale` seeded at `:root`
  and never reset per element.
- **MODIFIED** `demo/conformance.html` — two new checks: the fallback layer is
  declared first, and its reset set equals the paint rule's slot set.
- **MODIFIED** Every documented preflight `@layer` statement lists
  `largen.fallback`. This is load-bearing, not cosmetic: a sublayer's position
  is creation order, so a preflight that omits it appends the fallback after
  `largen.modifiers` — where the resets beat every component in exactly the
  engines the fallback exists for.
- **MODIFIED** The browser-floor documentation. The floor set by `color-mix()`,
  `@layer`, `revert-layer` and `:where()` still has no fallback path;
  `@property` becomes the stated exception.

## Capabilities

### Modified Capabilities

- `distribution`: the browser floor drops to Safari 16.2+ / Firefox 113+ for
  `@property` only, via a compiled fallback; the no-fallback stance is
  restated as applying to everything else
- `style-algebra`: slot registration gains a mirrored fallback layer and the
  layer order gains `fallback` below `reset`
- `authoring-contract`: the failure modes teach that a preflight `@layer`
  statement must list every largen sublayer, and why omitting `fallback` fails
  only in the engines it exists for

## Impact

- **New:** `src/fallback.css`
- **Modified:** `src/largen.css`, `skill/scripts/verify.mjs`,
  `site/test/run.mjs`, `site/test/matrix.mjs`, `site/mcp/contract.mjs`,
  `demo/conformance.html`, `README.md`, `MIGRATING.md`,
  `skill/scripts/pages.mjs`, `skill/scripts/releases.mjs` (README-pin guard),
  `genai/releases.json`
- **Reused rather than rebuilt:** the fallback is Tailwind v4.1's compiled
  output transposed onto largen's slot names — including the `@supports`
  engine sniff verbatim, because CSS has no direct way to ask whether
  `@property` is supported.
- **No new dependency.** Plain CSS in a plain file; the bundler inlines it
  like every other import.
- Shipped files change, so the version moves to 0.5.2 and `largen release`
  records a new digest. `largen.css`'s build id moves off `5445bbba` — the
  first CSS change since 0.4.0.
- **Not in scope:** lowering the `color-mix()` floor. Below Safari 16.2 /
  Firefox 113 the design still fails rather than degrades, and the
  documentation keeps saying so.
