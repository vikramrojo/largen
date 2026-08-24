# Arm A — build it with largen

You are one of two agents building the same page from the same brief. The other is
using a different substrate. You will not see its work and it will not see yours.

## Your substrate

largen, a property algebra for CSS. Components are bundles of custom properties
rather than modifier classes: you set slots like `--bg` and `--pad`, and a single
universal paint rule applies them.

**Read `llms-compact.txt` in your directory before writing anything.** It is the
whole authoring contract — the slots, the layer rule, the four axes, and the ways a
component fails silently. You are expected to need it: largen is new and almost
certainly absent from your training data. Do not guess at its API from the name.

`largen.css` and `theme-dark.css` are already in your directory. Link them in that
order, then your own stylesheet. `theme-dark.css` is where the dark tokens live —
without it there is no dark theme to inherit, and the brief asks for one.

## What to write

- `components.css` — your components, inside `@layer largen.components`
- `index.html` — the page, linking `largen.css` then `components.css`

## Rules that are not style preferences

These come from the contract and getting them wrong fails silently:

- Author inside `@layer largen.components`. Unlayered CSS outranks
  `largen.modifiers`, so `data-variant` stops applying while tone and size keep
  working — it looks like it works.
- No colour literals. Route colour through tokens or tone derivations.
- Do not reach past the tone axis to a raw semantic token like `--danger`.
- Theme comes free if you use tokens. Do not write a dark-mode block.

## Checking your own work

Run `npx largen verify components.css` before you finish, and fix what it reports.
If you want to know why a declaration is not applying, `npx largen cascade` answers
it without a browser.

## Constraints

Write only inside your own directory. Do not run git. Do not install anything.
