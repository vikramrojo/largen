# Build largen

## Why

Component CSS frameworks ship a catalog: a fixed set of components, each carrying
its own private copy of the same colour logic. daisyUI is the clear case — it
already contains a property algebra, but re-derives it inside each of its ~61
components against a component-private slot:

```css
.badge-soft { background-color: color-mix(in oklab, var(--badge-color) 8%, …); }
.btn-soft   { background-color: color-mix(in oklab, var(--btn-color)   8%, …); }
```

The same rule, written 61 times, and a tone that can never be set once for a
subtree. Meanwhile the catalog is a fixed cost you pay whether or not your
project needs a carousel.

largen hoists that algebra above the catalog and points it at one generic slot.
What was 61 rules becomes one. What was a catalog becomes ~6 lines per component,
written by the project in its own vocabulary.

The target is replacing **Tailwind and daisyUI entirely** on rojos.us. Measured
across `rojos-us/src` — 278 distinct Tailwind classes, 1050 tokens — 75% of that
usage lives inside components and dissolves when those become largen components.
The residual is 88 utilities across 12 files, almost purely layout.

## What Changes

- **NEW** A property algebra: 12 registered slots, four axes (tone, variant,
  size, state), and a single universal paint rule.
- **NEW** A material token vocabulary — `--canvas`, `--ink`, `--surface`,
  `--line`, plus semantic tones with their on-colours.
- **NEW** Seven layout utilities — `stack`, `row`, `cluster`, `center`, `grid`,
  `switcher`, `sidebar` — intrinsically responsive, no breakpoint system.
- **NEW** Optional reference components and a `prose` component.
- **NEW** An optional CLI (`largen build|verify|gen`) and an agent skill.
- **NEW** A generative-UI allowlist: manifest, JSON Schema, prompt fragment, and
  a zero-dependency validator.
- **NEW** A complete rojos.us component set as the proving ground.

**No build step.** largen is plain CSS; `dist/` is minified concatenation, not
compilation. This is a hard constraint on the design, not a convenience — the
universal paint rule exists specifically so that nothing needs to be told which
elements are components.

## Capabilities

### New Capabilities

- `design-tokens` — the material vocabulary and the theme contract
- `style-algebra` — slots, the guaranteed-invalid mechanism, the four axes
- `layout-primitives` — the seven utilities and intrinsic responsiveness
- `component-authoring` — how a component is written and addressed
- `distribution` — CDN drop-in, unbuilt operation, optional tooling
- `agent-authoring` — the skill as the build-time agent interface
- `generative-ui` — the run-time allowlist and its safety property

### Modified Capabilities

None. This change creates the baseline.

## Impact

- New repository. No existing consumers, so no migration path is required.
- Browser floor: Safari 16.4+, Chrome 111+, Firefox 128+ (`@property`,
  `color-mix()`, `@layer`, `:where()`, `revert-layer`). No fallback path — the
  design does not degrade, it fails.
- A prototype at `Git/origen` is superseded and stays only as reference.
