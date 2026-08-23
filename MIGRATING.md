# Migrating a site to largen

A runbook, written against a migration that actually happened: a personal site
with a blog, a project list and 24 mathematical callout types. It finished at
**556 lines of CSS** — 488 of components, 57 of theme, 11 of imports — replacing
`tailwindcss`, `daisyui`, a `shadcn`/`radix` `ui/*.tsx` registry,
`class-variance-authority`, `clsx`, `tailwind-merge` and a hand-written
`typography.css`. Built, it was **20.1kb, 4.8kb gzipped**, and it needed no build
step to work at all.

Every figure below is measured from that migration. They are reported so the
shape is concrete, not because you can re-run them — that site is not in this
repository. What *is* here is `sites/example/`, a smaller worked component set
that demonstrates the patterns; it is a different artifact and not the source of
these numbers.

Read that as a shape rather than a promise. Your site is not that site. But the
sequence below is the one that produced it, and the mistakes flagged are the ones
that are expensive to make.

---

## The idea you have to accept first

largen is not a component library you adopt. It is an algebra, and **you write
the components**. A migration is therefore not "swap `.btn` for `.button`" — it is
*deleting* a component catalog and replacing it with about six lines per
component of your own, named in your own domain language.

That component set contained no `card`, no `alert`, no `button`. It contained
`entry-card`, `callout`, `work-entry`, `toc-link`, `post-nav-item`. Those are
nouns from a site about writing, not nouns from a UI kit. If your
migrated stylesheet reads like a UI kit, you have ported the catalog instead of
replacing it, and you have kept the coupling you were trying to remove.

The corollary is what makes migration cheap: **you are not porting the variant
matrix.** Tone, variant, size, state and both themes come from underneath. Every
line in your old stylesheet that exists to express "the danger version of this,
in dark mode, at large size" has no counterpart. It evaporates.

---

## Phase 0 — Decide what you are *not* migrating

Do this first, and write it down, because it is the decision most likely to be
made badly under momentum.

**largen replaces theming. It does not replace behaviour.** That migration kept
`radix`'s `ScrollArea` and its PDF viewer, and the note left in the stylesheet
says why: *"Those are behaviour, not theming."* Focus trapping, virtual
scrolling, drag and drop, date-picker keyboard semantics, combobox ARIA — none of
that is CSS, and a stylesheet cannot give it to you.

Sort every dependency into three piles:

| Pile | Examples | Action |
|---|---|---|
| Theming | tailwind, daisyUI, CVA, clsx, tailwind-merge, a typography stylesheet, a `ui/*` registry that is mostly styling | **Replace** |
| Behaviour | focus trapping, virtualisation, complex ARIA widgets, PDF/canvas/media | **Keep** |
| Platform already does it | modal, disclosure, popover, dialog, form validation | **Delete and use the element** |

That third pile is bigger than it looks. `<dialog>` is the modal, `<details>` is
the collapse, and largen themes bare elements already. That site's accordion
and its 24-type callout were both `<details>`, with about fifteen lines of CSS
between them.

**Write your pile assignment into a comment at the top of your component file.**
It is the thing future-you will most want and least remember.

---

## Phase 1 — Inventory what is genuinely in use

Two questions, and the second matters more.

**What components exist?**

```sh
# Your own component set, if you already have CSS
npx largen manifest src/**/*.css

# Or count the registry you are replacing
ls src/components/ui/*.tsx | wc -l
```

**Which of them are actually used, and how often?** A registry ships ~50
components; a site typically renders twelve. Grep the templates, not the
registry:

```sh
grep -rhoE '<[A-Z][A-Za-z]+' src/pages src/layouts src/components \
  | sort | uniq -c | sort -rn | head -40
```

Everything with a count of zero is deleted, not migrated. This is usually the
single largest saving in the whole exercise and it costs one command.

**Find the variant configs.** These are where the line count is hiding:

```sh
grep -rln "cva(\|clsx(\|twMerge(\|tailwind-merge" src/ | head -20
grep -rc "dark:" src/ | grep -v ':0$' | sort -t: -k2 -rn | head -20
```

Every `dark:` occurrence is a line that should not survive migration. Count them
now so you can check later that they are gone.

---

## Phase 2 — One theme, one dialect

Before any component, write your theme: the tokens, once.

That site had declared its palette **twice** — once as shadcn tokens
(`--background`, `--foreground`, `--muted`, `--destructive`) and again, in
parallel and entirely unused, as daisyUI's (`--color-base-100`,
`--color-base-content`). That is normal for a site that accreted two systems, and
it is exactly the redundancy a migration should collect.

You need eleven or so values, and a dark block that overrides the same names:

```css
:root, [data-theme="light"] {
  --canvas: oklch(1 0 0);
  --ink: oklch(0.145 0 0);
  --ink-muted: oklch(0.556 0 0);
  --surface: oklch(0.97 0 0);
  --line: oklch(0.922 0 0);

  --primary: oklch(0.205 0 0);   --primary-on: oklch(0.985 0 0);
  --danger:  oklch(0.577 0.245 27.325); --danger-on: oklch(0.985 0 0);
  color-scheme: light;
}

[data-theme="dark"] {
  --canvas: oklch(0.145 0 0);
  --ink: oklch(0.985 0 0);
  --surface: oklch(0.269 0 0);
  --line: oklch(1 0 0 / 12%);
  /* …the same names, different values… */
  color-scheme: dark;
}
```

Two things worth knowing while you do this:

- **A near-monochrome site is normal.** That site's "primary" was near-black, so
  `neutral` carried almost all of its UI. Do not invent a colour system you do
  not have.
- **Site-wide typography is a theme concern, not a component one.** That site's
  identity was one monospace face, light, with tight tracking — expressed before
  the migration as an `@apply … tracking-tighter font-light` on the universal
  selector, and afterwards as three token values plus one `body` rule.

**This is the last time you write a colour.** From here on, components name
`var(--tone-soft)` and the theme decides what that is.

---

## Phase 3 — Author components, leaf-first

Work from the inside out: the smallest, most-repeated things first (`tag`,
`avatar`, `nav-link`), then the containers that hold them. Leaf-first means every
container you write is already made of finished parts, and you see real results
on day one.

Each component is a bundle of slots and a little shape:

```css
@layer largen.components {
  .entry-card, entry-card {
    --border-color: var(--line);
    --border-width: var(--hairline);
    --border-style: solid;
    --radius: var(--radius-lg);
    --pad: 1rem;
    --transition: var(--speed) background-color;
    display: block;
    text-decoration: none;
  }

  .entry-card:hover, entry-card:hover {
    --bg: color-mix(in oklab, var(--surface) 55%, transparent);
  }
}
```

Three habits that make the difference:

**Write the interaction once, not per element.** That site's signature was links
muted until hovered — `text-foreground/60 hover:text-foreground transition-colors`
repeated on every link in the codebase. It became one component with one hover
rule, and every link got it. `sites/example/` shows the shape as `.entry-link`.

**Multiply by `var(--scale)` wherever you set a size**, and express the rest in
`em`. That is what buys you the size axis for free; it is also why you never write
a size variant.

**Set `--tone`, not colours.** The headline conversion was the callout:
`callout.astro` carried a 24-entry CVA config, roughly **100 lines of
hand-written colour strings** — two per type per colour mode, like
`border-blue-500 dark:bg-blue-950/5` alongside `text-blue-700 dark:text-blue-300`.
It became one shape rule plus this:

```css
.callout[data-type="note"]    { --tone: var(--hue-blue) }
.callout[data-type="tip"]     { --tone: var(--hue-green) }
.callout[data-type="warning"] { --tone: var(--hue-yellow) }
/* …21 more, one line each… */
```

**Dark mode is never mentioned**, because `--tone-soft` and `--tone-ink` resolve
against `--canvas` and `--ink`. That is the whole trick, and it generalises: any
time you are about to write a `dark:` variant, you have found something the
algebra should be doing for you.

### Check each component as you write it

Locally:

```sh
npx largen verify
```

Or over MCP, which is the same rules from the same module, and is useful when the
agent doing the migration is not sitting in this repository:

```sh
claude mcp add largen --transport http https://largen.exe.xyz/api/mcp
```

Then `check_component_css` on what you just wrote, and `get_contract` when you
are unsure. Both take snippets, so you can check a component before it is in a
file.

---

## Phase 4 — Convert the templates

Now the markup. The pattern is: a long `class` attribute becomes a component name
plus, at most, an axis attribute.

```html
<!-- before -->
<div class="rounded-xl border bg-card p-4 hover:bg-muted/50 transition-colors
            dark:border-neutral-800 text-sm">

<!-- after -->
<div class="entry-card">
```

```html
<!-- before -->
<div class="border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/10
            text-amber-800 dark:text-amber-200 rounded-md px-4 py-3">

<!-- after -->
<details class="callout" data-type="warning">
```

Go page by page, not component by component, and **keep the old stylesheet loaded
until a page is fully converted**. A half-converted page under both systems is
readable; a half-converted codebase under neither is not.

If your framework has a class-merging helper (`cn`, `clsx`, `twMerge`), delete
the call rather than porting it. There is nothing left to merge — a component
name and a `data-tone` do not conflict, which is the point.

---

## Running both at once

A migration is not atomic, and largen alongside Tailwind is where the sharp edges are.
Three came out of a real Astro integration.

**Declare every layer in one statement, before largen loads.** A layer's position is
fixed the first time it is mentioned, so whatever order your `@layer` statement lists,
layers largen named first keep theirs and yours are appended after. Put a preflight ahead
of largen explicitly or it sorts last and flattens every heading, list and border largen
styled — and because layer order beats specificity, no selector weight recovers it.

```css
@layer app-base,
       largen.reset, largen.tokens, largen.paint, largen.tone,
       largen.elements, largen.components, largen.modifiers,
       app-overrides;
```

**Use flat names, not sublayers, for your own halves.** `app.base` and `app.overrides`
are children of one `app` layer with one position, so they cannot straddle largen: once
`app` is placed, `app.overrides` is stuck wherever its sibling put it. `app-base` and
`app-overrides` are independent and can sit on either side. This fails silently — the
statement reads correctly and does something else.

**Read the compiled output, not the utility name.** A `marker:` utility compiles to two
rules, and the descendant one does the work: a bullet belongs to `li::marker`, so styling
`ul::marker` alone changes nothing. That generalises — when a utility does not do what its
name suggests, look at what it compiled to before assuming the cascade is at fault.

### Three things that do not survive the conversion

**Line height does not come along.** Tailwind's `text-sm` bundles a line-height —
`1.25rem` against a `0.875rem` font — and converting only the size leaves the element
inheriting `1.5`. That made callouts about 9% taller in one conversion, and it has now
caught badge, button, crumbs and callout in the same project. largen has no `line-height`
slot: the twelve are what the paint rule consults, and a thirteenth would still need
remembering. Carry it as ordinary CSS in the component, and check it on every element
whose font size you change.

**Mix ratios do not transfer between shades.** `bg-blue-950/5` is five percent of a *950*
shade. Mixing a *500* shade at five percent lands several times too strong; around 1.5%
matched the rendered lightness. Convert by comparing the result, not the number.

**Rule 3 sometimes costs parity, and it is worth saying so.** A tint applied only in dark
mode cannot be reproduced without a dark-mode rule. Mixing it against `--canvas` makes it
follow the theme by construction, which is the right answer — and it means light mode
gains a faint tint it did not have before. That is a real difference, not a rounding
error. Decide it deliberately rather than discovering it in a screenshot diff.

### On `!important`

Migrations inherit `!important` from whatever came before. In one real conversion none of
them were load-bearing: every selector already outweighed what it was beating, and the
declarations were there defensively. `largen verify` rejects `!important` outright, which
is a good forcing function — largen is layered and `:where()`-wrapped precisely so your CSS
wins without it.

## Phase 5 — Verify, including with your eyes

```sh
npx largen verify        # static: layers, colour literals, tone bypass, slots
npx largen manifest src/components.css --out largen.manifest.json
```

`verify` is static and **it is not sufficient**. This library's own history is
twelve static checks passing while six components were visibly broken. Render
every converted page in a browser, **in both themes**, and look at it.

```sh
# a serviceable screenshot pass, no dependencies
for page in / /blog /about; do
  for theme in light dark; do
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
      --headless --disable-gpu --hide-scrollbars \
      --screenshot="shot-${theme}.png" --window-size=1280,1600 \
      "http://localhost:4321${page}?theme=${theme}"
  done
done
```

Then check the numbers you took in Phase 1:

```sh
# Strip comments first. Your migrated CSS will quote the old Tailwind strings in
# comments explaining what was replaced, and a naive grep counts those as
# failures. A check that cries wolf gets ignored.
grep -rn "dark:" src/ --include=*.css --include=*.astro --include=*.tsx \
  | grep -vE '^\s*\*|/\*|//' | head
grep -rln "cva(\|twMerge(\|clsx(" src/          # expect nothing
```

Both should come back empty. If `dark:` survives anywhere that is not a comment,
that component is doing by hand something the tone derivations were going to do
for it.

### The one failure to memorise

If `data-variant` stops applying while `data-tone` and `data-size` keep working,
**your component is declared outside `@layer largen.components`**. An unlayered
component outranks `largen.modifiers`, so variant loses — but tone and size act
through inheriting custom properties rather than by overriding slots, so they are
unaffected.

One dead axis and two live ones looks like a bug in the library. It is the most
expensive way to lose an afternoon in this system, and `largen verify` and
`check_component_css` both catch it in a second.

---

## Phase 6 — Delete the old stack

Only now, and all at once:

```sh
npm remove tailwindcss daisyui class-variance-authority clsx tailwind-merge
rm -rf src/components/ui/       # the registry
rm src/styles/typography.css
rm tailwind.config.* postcss.config.*
```

Then confirm nothing silently depended on it — build, and screenshot again. A
removed PostCSS plugin can take something with it that no static check will
notice.

---

## What to expect

From that conversion, as reference points rather than targets:

| | |
|---|---|
| Component CSS | **488 lines**, 31 components — ~16 lines each including comments and blank lines |
| Theme | **57 lines**, one dialect instead of two |
| Built | **20.1kb**, **4.8kb gzipped**, whole site |
| Build step | none — the unbuilt stylesheet is the same stylesheet |
| `dark:` variants | zero |
| Kept deliberately | ScrollArea, PDF viewer — behaviour, not theming |

The largest single conversion was the callout: ~100 lines of CVA colour strings
to 24 one-line rules and one shape rule. The second largest was pagination and
breadcrumbs — ~120 lines of TSX across two radix + CVA components — which became
two small component rules and ordinary `<ol>` markup.

## Sequencing advice

Migrate in this order and each step is independently shippable:

1. Theme only, loaded *alongside* the old stack. Nothing should change visually.
2. One leaf component, one page. Confirm the axes work by adding a `data-tone` to
   a container and watching the subtree re-tone.
3. The rest of the leaves.
4. Containers, page by page.
5. Delete.

Stop after any step. A site running largen's theme and Tailwind's utilities is a
perfectly stable place to leave things for a week.

---

## Reference

- Contract, axes and authoring rules: <https://largen.exe.xyz/docs/contract.html>
- The whole contract in one file, for an agent: <https://largen.exe.xyz/llms-compact.txt>
- MCP: `claude mcp add largen --transport http https://largen.exe.xyz/api/mcp`
- A worked example component set in this repository: `sites/example/` — the
  patterns above at a smaller scale. It is not the migration these figures were
  measured from.
