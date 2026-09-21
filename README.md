# largen

A property algebra for CSS. Plain CSS — no build step, no preprocessor, no plugin.

largen ships almost no components. It ships the machinery that makes a component
cheap to write, so your project writes its own dozen in its own vocabulary
instead of adopting someone else's sixty.

```html
<link rel="stylesheet" href="largen.css">
```
```css
@layer largen.components {
  .notification {
    --bg: var(--tone-soft);
    --fg: var(--tone-ink);
    --border-width: 0 0 0 3px;
    --border-color: var(--tone);
    --border-style: solid;
    --radius: var(--radius-md);
    --pad: .75em 1em;
    --gap: .75em;
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
  }
}
```
```html
<notification data-tone="warning">Two accounts need review.</notification>
```

Ten lines, and that is a complete component: seven tones, four variants, five
sizes, every state, both themes — none of which it mentions.

## The shape

```
TOKENS      --canvas --ink --surface --line, tones + on-colours    theme sets these
SLOTS       --bg --fg --pad --gap --radius --font-size …           library, fixed
AXES        tone · variant · size · state                          library, fixed
PAINT       one universal rule                                     library, fixed
──────────────────────────────────────────────────────────────────────────────────
UTILITIES   stack row cluster center grid switcher sidebar         library, fixed
──────────────────────────────────────────────────────────────────────────────────
COMPONENTS  whatever your project needs                         ← you write these
```

| | gzipped |
|---|---|
| `largen.css` — algebra + layout utilities | **2.35kb** |
| reference components (optional) | 1.89kb |
| a dark theme | 0.40kb |
| a whole site (algebra + prose + theme + a project's own components) | **3.95kb** |

Zero runtime JavaScript.

## Why there is no build step

Every element is painted by one rule:

```css
@layer largen.paint {
  * { padding: var(--pad, revert-layer); /* …11 more… */ }
}
```

That looks reckless — `padding: 0` on every element would destroy every `<ul>`
indent. It doesn't, because of how the slots are registered:

```css
@property --pad { syntax: "*"; inherits: false; }   /* no initial-value */
```

With universal syntax and **no `initial-value`**, an unset slot is
*guaranteed-invalid*, so `var()` falls back — and the fallback is `revert-layer`,
which hands the property straight back to the UA stylesheet. The rule is inert
until a component opts in.

Because paint reaches every element, nothing has to declare itself a component.
No marker attribute, no registration, no generated selector list, no build.

## The axes

| axis | attribute | values | inherits |
|---|---|---|---|
| tone | `data-tone` | primary secondary success info warning danger neutral | **yes** |
| variant | `data-variant` | solid soft outline ghost | no |
| size | `data-size` | xs sm md lg xl | **yes** |
| state | — | `:disabled` `:user-invalid` `:read-only` `:focus-visible` | from the DOM |

Tone inheriting is the point:

```html
<section data-tone="danger">
  <div class="notification">…</div>   <!-- red -->
  <button>…</button>                  <!-- red -->
</section>
```

Neither child says "danger". Seven tones × four variants × five sizes is 140
appearances from about twenty rules.

## The one rule to know

**Author components inside `@layer largen.components`. Override them from
outside it.**

Unlayered CSS beats every layer — that is what makes overriding work without
`!important`, and it is exactly what breaks an unlayered *component*: it
outranks `largen.modifiers`, so `data-variant` silently stops working while tone
and size keep going. If a variant isn't applying, check this first.

## Use

No install needed — it is a stylesheet:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/largen@latest/dist/largen.css">
```

unpkg serves the same package at `https://unpkg.com/largen@latest/dist/largen.css`, and
`largen.components.css` and `theme-dark.css` sit beside it. Or install it:

```
npm install largen        # the CSS, the linter, and the importable modules
```

Nothing here is a dependency in the build sense. Installing gets you a stylesheet and
some optional dev-time commands, not a step between your source and your page.

### Pinning

`@latest` follows the newest release, so the bytes change when largen does. That is right
for a demo and wrong for production — and CDNs cache it for hours, so it is not prompt
either.

A version is immutable in a way a URL convention cannot be: npm will not accept a second
publish of a version that already exists, so `largen@0.5.2/dist/largen.css` is the same
file forever.

```html
<link rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/largen@0.5.2/dist/largen.css"
      integrity="sha384-J4z0ZgNQ8H8T1CdwNFfvZ76JfN3Y4h4vGx/1RrcL5ZfX9ytAEEjBPancxbJIROA6"
      crossorigin="anonymous">
```

**`integrity` and `@latest` do not go together.** The hash is of one specific build, so it
would fail the moment a release lands — loudly, which is the point of SRI, but not what
you wanted. Pin the version if you want the check.

To get the hash for any version, from the bytes you will actually be served:

```
curl -s https://cdn.jsdelivr.net/npm/largen@0.5.2/dist/largen.css |
  openssl dgst -sha384 -binary | openssl base64 -A
```

`npm install` and both CDNs resolve to the same tarball, so a pinned version is
byte-identical wherever you take it from and one `integrity` string validates all three.
The release check enforces that rather than assuming it.

The `+abcd1234` suffix in the banner is the *build id*: a hash of the bundle before the
banner was added. It names the build but is not the file's digest, and two versions
sharing one build id have identical CSS differing only in the version string — 0.3.0
through 0.3.5 were one such run, and 0.4.0, 0.5.0 and 0.5.1 another (`5445bbba`; the
0.5.x pair changed tooling and documentation, not CSS). 0.5.2 is the first build since
0.4.0 to change the CSS — the `@property` fallback layer. [RELEASES.md](RELEASES.md)
says when each happened, and every entry there is checked against the bytes that
version shipped.

### Measuring a themed page

`largen probe` reads computed styles in a real browser. If the page manages its own
theme, tell the probe where that theme comes from rather than letting it override the
page afterwards:

```
largen probe --page ./index.html --select .brand --prop color \
             --theme light --theme dark --theme-storage theme
```

`--theme-storage` names the `localStorage` key the page reads. The probe writes it
before the page loads, so the page applies the theme itself — completely, the way it
does for a visitor. It is restored afterwards.

The alternative is to set `data-theme` on the page after it has loaded, and that is
worth understanding before relying on it. A theme is usually applied through more than
one output: an attribute, sometimes a class, and often the palette written straight onto
`<html>` so nothing repaints. Overriding the attribute moves the attribute. An inline
style beats every author rule, so a pinned palette stays where it was, and what you read
is a mix of two themes in a state no visitor can be in — while the attribute you set
sits there looking correct.

The probe detects that and refuses to report values rather than returning the mixture,
and every row discloses what it actually observed, including any properties pinned
inline. But the check can only catch the cases it can see. Driving the source has no
such limit, so prefer it.

## What largen does not do

Behaviour. Focus trapping, popovers, virtual scrolling — that is the platform's
job, or radix's. `<dialog>` is the modal and `<details>` is the collapse; both
are already themed. largen does not ship a `.modal` that has to relearn Esc
handling.

It also ships no atomic utility layer. Rebuilding a miniature Tailwind is the
layer this project argues is convenience without insight.

## Tooling — all optional

```
npx largen verify [css...]            # check your components against the contract
npx largen build                      # bundle + minify to dist/, for CDN
npx largen gen                        # regenerate genai artifacts
npx largen theme <file.tokens.json>   # a DTCG token document in, a theme stylesheet out
npx largen tokens <file.css>          # the other direction: a stylesheet in, a token document out
npx largen manifest <css...>          # derive a component manifest from your CSS

npx largen cascade --property --weight --at "html body p.prose kbd" <css...>
                               # which declaration wins, and which cascade step decided it
npx largen slot --slot --fg --at "html body a.link" <css...>
                               # whether the paint rule applies a slot, or it reverts
npx largen probe --page ./index.html --select .badge --prop line-height
                               # a browser harness for what static checks cannot see
```

`cascade` and `slot` answer "why is this computing as that" without a browser. They take
the element as an ancestor chain, which carries no siblings and no interaction state — so
rules turning on `:hover` or `:last-child` come back as *undecidable* rather than being
quietly dropped. `probe` settles those.

`verify` is static only. It has passed clean on visibly broken components before;
render the demo pages in a browser too.

### Themes as token documents

A theme is the one file a project writes that largen cannot check for it, so it
travels as data too. `largen theme` takes a [W3C Design Tokens Community
Group](https://www.designtokens.org/tr/drafts/format/) document — what Figma,
Tokens Studio, Style Dictionary and Penpot read and write — and emits a theme
stylesheet, having first checked it against largen's vocabulary. `largen
tokens` reads the other way, deriving a document from a stylesheet you already
have, so the pair is a round trip rather than a one-way import.

```json
{
  "$extensions": { "dev.largen": { "theme": "dark", "colorScheme": "dark" } },

  "canvas": { "$type": "color", "$value": { "colorSpace": "srgb", "components": [0.0627, 0.0706, 0.0784], "hex": "#101214" } },
  "ink":    { "$type": "color", "$value": { "colorSpace": "srgb", "components": [0.949, 0.9569, 0.9647],  "hex": "#f2f4f6" } },
  "tone": {
    "$type": "color",
    "primary": {
      "$root": { "$value": { "colorSpace": "srgb", "components": [0.3529, 0.6627, 0.9412], "hex": "#5aa9f0" } },
      "on":    { "$value": { "colorSpace": "srgb", "components": [0.0392, 0.0863, 0.1333], "hex": "#0a1622" } }
    }
  }
}
```

```
npx largen theme dark.tokens.json --scheme-media --out themes/dark.css
npx largen tokens themes/brand.css --out brand.tokens.json
```

A document may be partial — a theme sets what it changes and inherits the rest —
but it is checked as a subset: a tone that sets `$root` without `on` is an
error, because a solid variant is impossible without the pair, as is a
`space.*` that is not in rem, a reference that resolves in a cycle, and an extra
whose name flattens onto a registered slot like `--pad`. On any error nothing is
written. `--scheme-media` emits the `prefers-color-scheme` block from the same
document rather than having you write those declarations twice.

A reference keeps its indirection: `{brand.paper}` is emitted as
`var(--brand-paper)` rather than flattened to whatever that token holds. So a
reference may point at a property some other stylesheet declares — a light and
dark pair can split its extras across two documents, each referring to the
other's — and a theme that moves one token moves everything pointing at it.
largen cannot see the rest of the cascade, so a name the document does not
define is a warning rather than an error, and the file is still written. A
cycle stays an error: that one is provable from the document alone, and no
browser resolves it.

`largen tokens` goes the other way. It finds the rule that declares custom
properties — not merely the first rule, which in a real stylesheet is as likely
to be `@font-face` — maps what it finds onto the vocabulary, keeps the rest as
project extras, and warns when a sheet declares no tokens or declares them in
more than one place, rather than handing back a short document with no comment.

The CSS is the source of truth, not the JSON. `largen build` exports the
defaults as `dist/largen.tokens.json` and the dark theme as
`dist/theme-dark.tokens.json`, and `largen verify` fails if either drifts from
the stylesheet it came from. The shape of those documents is a promised surface,
pinned to DTCG draft 2025.10 and named in every document: a change to it rides a
minor release, like a change to the CSS.

### Bringing your own minifier

`largen build` uses no third-party code — it inlines `@import`s, strips comments
and squeezes whitespace, which is all largen's own stylesheet needs. Measured
against [lightningcss](https://lightningcss.dev), the difference is 46 gzipped
bytes, and largen has nothing to transpile: its browser floor is set by
`color-mix()`, `@layer` and `revert-layer` (`@property` carries its own
compiled fallback), so there is nothing below it to lower to.

Your stylesheet is a different question. A real minifier earns its keep when you
have a large theme or component set of your own, and it is the answer if you need
syntax lowering for targets below largen's floor, or CSS-module-style scoping.
Point it at your own build output — largen's own does not need one:

```sh
npx lightningcss --minify --bundle --targets '>= 0.25%' src/site.css -o dist/site.css
```

Nothing about that changes how largen works. It is packaging, the same as
`largen build` is.

## For agents

`skill/SKILL.md` is the build-time interface — the slot vocabulary, the axis
values, the layer rule, and the failure modes. `genai/` is the run-time
interface: an approved-component allowlist with a JSON Schema and a
zero-dependency validator whose output has no field for a colour, class or
handler, so its safety property is structural rather than defensive.

## Demos

Two pages, both evidence rather than showcase.

```
demo/conformance.html the guaranteed-invalid mechanism and its @property fallback, asserted — prints PASS/FAIL
demo/tests.html       the load-bearing claims, visible on one page
```

`sites/example/` is a worked component set — not a demo, but the thing `largen
build`, `largen verify` and the MCP test suite all exercise.

The documentation site, the playground and a migration runbook are at
<https://largen.exe.xyz>.

## Requirements

Safari 16.2+, Chrome 111+, Firefox 113+ — the floor set by `color-mix()`,
`@layer`, `:where()` and `revert-layer`. For those there is still no fallback
path; the design does not degrade, it fails.

`@property` is the one exception. The `largen.fallback` layer — Tailwind v4.1's
compiled fallback transposed onto largen's slots, behind the same engine-sniff
`@supports` — re-declares every slot to `initial` per element in the two engine
ranges that have everything above except `@property`: Firefox 113–127
(including ESR 115) and Safari 16.2–16.3. On an unregistered custom property,
`initial` is the guaranteed-invalid value, so the mechanism survives intact. In
every engine with `@property` the guard matches nothing and the registrations
stay authoritative. This does not lower the `color-mix()` floor; below it,
nothing here helps.

`demo/conformance.html` asserts the mechanism from `getComputedStyle` and prints
a pass/fail verdict, so this is checkable rather than claimed — 13 checks, run
headlessly by `site/test/conformance.mjs` on every release. The floors above are
inferred from published support data; the fallback's own behaviour is only
exercised for real in the engines it exists for.

The full explanation of how the system works lives in
[`openspec/changes/build-largen/design.md`](openspec/changes/build-largen/design.md).

MIT.
