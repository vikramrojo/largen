# Brief: rebuild two screens from the images

Two PNGs are in your directory. Rebuild what they show.

| file | build it as |
|---|---|
| `screen-1-landing.png` | `index.html` |
| `screen-2-content.png` | `content.html` |

Two HTML files and a stylesheet of your own. No build step, no JavaScript, no web
fonts, no images — everything on both screens is type, shape and colour, and the
partner marks in screen 2 are placeholders you may draw with text or CSS.

**Look at the images.** They are the specification. Nothing below describes the
layout, the type scale, the spacing or the weights; that is what you are being
asked to read off the reference. The text is given only so that both screens carry
the same words, and the hooks are given only so the result can be measured.

## The copy, verbatim

### Screen 1 — `index.html`

- Nav, left to right: `HOME` `STUDIO` `PROJECTS` — then a mark in the centre —
  then `SERVICES` `BLOG` `CONTACT`
- Eyebrow: `BRAND FORWARD`
- Headline, two lines: `CRAIFT` / `STUDIO©`
- One line beneath: `Crafting distinctive identities for ambitious brands`
- A row of five circular icon buttons across the foot of the screen. Use letters —
  `IG` `IN` `X` `Bē` `DR` — rather than icon files.

### Screen 2 — `content.html`

- Eyebrow: `GLOBAL CREATIVE PARTNERS`
- Six partner marks in a row
- The statement, one paragraph in two tones. The first part is the bright one:

  > **Nothing here happened overnight. Every© figure below marks progress, shaped
  > by real briefs,** real teams, and a steady push toward clearer work.

- Right column: `Craift Studio is an independent design practice. For over five
  years, we have helped growing companies refine brand, product, and the systems
  that connect them.`
- Beneath it, a link: `Learn more about us ↗`
- Three stat rows, separated by hairline rules — label on the left, figure on the
  right:

  | | |
  |---|---|
  | Since | 2020 |
  | Projects | 150+ |
  | Awards | 25+ |

## Required hooks

Both screens must carry these ids, on the elements described. They are how the
pages are measured. How you style them is entirely your business — the point of an
id rather than a class is that the question can be asked of any substrate.

### `index.html`

| id | on |
|---|---|
| `nav` | the navigation bar |
| `nav-item` | the FIRST navigation item |
| `eyebrow` | the small pill above the headline |
| `hero` | the hero section |
| `hero-title` | the oversized headline |
| `hero-sub` | the single supporting line under it |
| `social` | the row of circular buttons |
| `social-item` | the FIRST circular button |

### `content.html`

| id | on |
|---|---|
| `partners` | the partners strip |
| `partners-label` | the tracked eyebrow above the marks |
| `partners-logo` | the FIRST partner mark |
| `about` | the section holding the statement |
| `statement` | the large paragraph |
| `statement-muted` | the dimmed remainder inside it |
| `about-body` | the small body copy in the right column |
| `about-link` | the `Learn more about us` link |
| `stat-row` | the FIRST stat row |
| `stat-label` | that row's label |
| `stat-value` | that row's figure |

Only the first of each repeated thing needs an id. The rest must exist and need no
hook.

## Light and dark

**The images show the dark rendering.** That is the one being compared against the
reference.

The pages must also render in light, and you must not design it separately — the
light rendering should follow from however your substrate handles theming. If it
takes a second hand-written palette, say so in a comment rather than writing one.

## What "done" looks like

`index.html`, `content.html`, and your own stylesheet, in the directory you were
given. Both must render standalone at 1280px wide with no server and no build
step. Do not edit anything outside your directory.
