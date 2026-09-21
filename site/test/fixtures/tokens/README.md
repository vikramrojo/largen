# Token document fixtures

DTCG documents (draft 2025.10, `$`-prefixed keys) for `largen theme` and for
`site/test/tokens.mjs`. Every file but the first two and `pair-light` is one
rule's witness: it produces exactly one diagnostic, so a check that stops
working turns exactly one assertion red. `pair-light` is the clean half of a
pair whose other half is the witness, and produces none.

| file | what it is for |
|---|---|
| `exe-like.tokens.json` | a whole consumer theme, shaped like exe's `exe.theme.css`: five material colours, all seven tone pairs complete, project extras (`text.*`, `font.tw`, `leading.*`, `control.*`, `tracking.*`, `measure-page`), the raw-CSS escape on `text.display`, `radius.sm` at zero, and `line-height-base` supplied as a rem dimension. Converts with one warning — the retype — and nothing else. |
| `dark.tokens.json` | a hand-written mirror of `themes/dark.css`: every token that theme sets, and no others. The import side of the round trip `largen build` exports. |
| `half-tone.tokens.json` | `tone.primary.$root` with no `on`. A solid variant is impossible without the pair. |
| `space-px.tokens.json` | `space.4` in px. Space stays in rem so a section gap does not grow under the size axis. |
| `cycle.tokens.json` | `a` references `{b}`, `b` references `{a}`. |
| `slot-collision.tokens.json` | extras that flatten to `--pad` and `--bg`. The universal paint rule would read them. |
| `typo-colour.tokens.json` | a colour `$value` of `"#12345g"`. A typo must not become an escape hatch. |
| `hex-only.tokens.json` | a colour with `hex` and no `components`. Accepted. |
| `components-only.tokens.json` | a colour with `components` and no `hex`. Accepted. |
| `both-disagree.tokens.json` | `hex` `#ffffff` against components `[0, 0, 0]`. Rejected, by name. |
| `pair-light.tokens.json` | the light half of a theme split across two documents: it declares the extra `brand.paper` and points `canvas` at it. Converts clean. The target half of the pair. |
| `pair-dark.tokens.json` | the dark half. `canvas` references `{brand.paper}`, which only the light half declares. One warning, and `--canvas` still emits `var(--brand-paper)` — a reference largen cannot see the other end of is not a resolution failure. |
| `ref-type-mismatch.tokens.json` | `canvas`, declared `color`, aliased to `{space.4}`, a `dimension`. One warning; the `var()` is emitted either way. |

The values in `exe-like.tokens.json` are exe-shaped rather than exe's: the cases
are real, the palette is not.
