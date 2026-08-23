# Tasks

## 1. Primitives
- [x] Register 12 slots with universal syntax, `inherits: false`, no `initial-value`
- [x] Register `--scale` as inheriting with an initial value
- [x] Material token vocabulary (`--canvas`/`--ink`/`--surface`/`--line`, tones + on-colours, hues)
- [x] Universal paint rule, layered, every declaration falling back to `revert-layer`
- [x] Minimal reset
- [x] Verify the guaranteed-invalid mechanism in a browser (h1/ul/button/td keep UA values)

## 2. Axes
- [x] Tone: seven values, inheriting, derivation formula written once
- [x] Variant: solid/soft/outline/ghost derived from tone
- [x] Size: `--scale`, inheriting
- [x] State from DOM pseudo-classes, with `:read-only` restricted to editable fields
- [x] Layer order `reset < tokens < paint < tone < elements < components < modifiers`

## 3. Layout utilities
- [x] `stack`, `row`, `cluster`, `center`, `grid`
- [x] `switcher` — container-width reflow with no media query
- [x] `sidebar` — intrinsic two-column collapse
- [x] Alignment via `data-align` / `data-justify`
- [x] Lists used as layout containers drop markers and UA indent

## 4. Bare HTML
- [x] Themed defaults for links, buttons, fields, fieldset, table, code, hr
- [x] `<dialog>` as the modal, `<details>` as the collapse

## 5. Optional components
- [x] Reference set (alert, badge, dot, spinner, skeleton, card, panel, divider,
      stat, menu, crumbs, steps, bubble, avatar, tip)
- [x] `prose`

## 6. Tooling
- [x] CLI: `build`, `verify`, `gen`
- [x] `build` — concatenate + minify to `dist/`, explicitly not compilation
- [x] `verify` — slot registration, revert-layer coverage, tone discipline,
      colour literals, layer membership, layer order, no `!important`
- [x] `gen` — regenerate genai artifacts from the manifest

## 7. Agent interfaces
- [x] `skill/SKILL.md` covering tiers, slots, axes, the layer rule, failure modes
- [x] Symlink `.claude/skills/largen` for discovery
- [x] genai manifest, generated schema/prompt, zero-dependency validator
- [x] Validator rejects unknown components, unknown axis values, injected
      properties, and disallowed nesting

## 8. Proving ground — rojos.us
- [x] Theme in material vocabulary
- [x] ~35 site components in the site's own vocabulary
- [x] All 24 callout types as one-line tone declarations
- [x] Demo page with zero markers and zero inline styles

## 9. Demos and verification
- [x] `demo/tests.html` — the load-bearing claims
- [x] `demo/rojos.html`
- [x] `demo/cdn.html` — a page whose only stylesheet is a CDN link
- [x] `demo/components.html` — the reference set
- [x] `demo/index.html` — entry point
- [x] Screenshot review of every demo page, light and dark
- [x] Large-DOM sanity check: 3009 nodes, insert + first layout 16.2ms

## 10. Open risk
- [x] Confirm the guaranteed-invalid mechanism on Safari 16.4+ and Firefox 128+
      via `demo/conformance.html`, which asserts the mechanism from
      `getComputedStyle` rather than by eye. 9/9 in all three engines:
      Safari 26.5.2 (macOS 26.5.2), Firefox 154.0, Chrome 151.0.7922.173.
      The 16.4 / 128 floors are inferred from published support data, not run.

## 11. Documentation
- [x] README
- [x] README points to `design.md` as the explanation
