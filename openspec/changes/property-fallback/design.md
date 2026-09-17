# Design

## The mechanism, and why it is exact rather than approximate

`src/properties.css` registers fourteen slots `syntax: "*"; inherits: false`
with no `initial-value`. Two behaviours follow, and the paint rule depends on
both: an unset slot holds the guaranteed-invalid value (so `var(--x,
revert-layer)` fires), and a set slot does not cascade onto children.

In an engine without `@property`, the slots are unregistered. Unregistered
custom properties inherit — that is the breakage — but they also define
`initial` as the guaranteed-invalid value. So a universal rule

```css
*, ::before, ::after, ::backdrop { --bg: initial; /* … all fourteen */ }
```

reproduces both behaviours at once. Every element carries its own declaration,
so no element inherits a parent's slot; an element whose declaration *is*
`initial` holds guaranteed-invalid, so the paint rule's `revert-layer`
fallback fires exactly as it does in a conforming engine. A component that
sets a slot wins over the reset because its declaration lives in a later
layer on the same element — specificity never enters into it.

`--scale` is the deliberate exception: registered `inherits: true,
initial-value: 1`, and the size axis sets it on `[data-size]` ancestors for
whole subtrees to read. It must NOT appear in the universal reset — that would
destroy the inheritance the axis depends on. Seeding `:root { --scale: 1 }`
reproduces the registration's initial-value and leaves inheritance to the
engine's default behaviour for unregistered properties, which for `--scale` is
the behaviour largen wants anyway.

`--tone` needs nothing: it was never registered, on purpose.

## The guard

```css
@supports ((-webkit-hyphens: none) and (not (margin-trim: inline)))
    or ((-moz-orient: inline) and (not (color: rgb(from red r g b))))
```

Tailwind v4.1's engine sniff, verbatim. CSS cannot ask "is `@property`
supported?", so this matches WebKit before `margin-trim` (Safari ≤ 16.3) or
Gecko before relative color syntax (Firefox ≤ 127). In every engine that has
`@property` the condition is false and the fallback costs nothing; the
registrations remain authoritative and the two never disagree, because verify
asserts the reset set mirrors the registration set byte for byte.

## Layer position, and the preflight trap

The fallback must sort below every largen layer, so `src/largen.css` lists it
first: `largen.fallback, largen.reset, …, largen.modifiers`. Within a parent
layer, sublayer order is creation order. That makes the documented preflight
statement a correctness surface: a consumer preflight that lists seven
sublayers and not `fallback` causes the fallback to be created when
`largen.css` loads — appended after `largen.modifiers`, where the resets beat
every component. The failure is invisible in any engine a developer is likely
to test in, because the guard is false there. Hence every documented preflight
(contract failure modes, MIGRATING.md, the run.mjs fixture that mirrors them)
gains the eighth layer, and the contract says why.

## What watches it

- `largen verify`: the layer-order invariant grows to eight; a new invariant
  parses both files and diffs the fallback's reset set against the
  `inherits: false` registrations, asserts `--scale` is seeded at `:root` with
  the registered initial-value and never reset per element, and asserts the
  guard's shape. The two files cannot drift silently.
- `demo/conformance.html`: check 12 asserts the layer statement declares
  `largen.fallback` first among all eight; check 13 walks the CSSOM (the
  `CSSSupportsRule` is present even where the guard is false) and asserts the
  reset set equals the paint rule's slot set. Both run in the headless
  conformance tier.
- The guard itself can only be true-positive-tested in the engines it targets.
  The conformance page documents this; the live-tab replay (delete the
  registrations, page must not change) is the manual protocol.

## Alternatives considered

- **A JS polyfill via `CSS.registerProperty`** — rejected: it shipped in the
  same engine versions as `@property`, so it polyfills nothing.
- **Dropping `@property` and shipping only the reset** — rejected: typed
  registration (`--scale: <number>`) and engine-managed non-inheritance are
  strictly better where available; the fallback is for the gap, not a
  replacement.
- **An unguarded reset** — rejected: fifteen declarations on `*` in every
  engine forever, to serve two dying browser ranges. The guard confines the
  cost to the engines that need it.
