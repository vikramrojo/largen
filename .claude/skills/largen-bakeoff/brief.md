# Brief: a landing page for "Kettle"

Build a single-page marketing site for **Kettle**, a fictional product that turns
scattered team notes into a searchable timeline. One HTML file, one stylesheet of
your own, no build step, no JavaScript.

The page has five sections, in this order.

1. **Hero.** Product name, a one-line promise, a sentence of supporting copy, and a
   primary call-to-action button. It should read as the loudest thing on the page.
2. **Features.** Three cards side by side on a wide screen, stacked on a narrow one.
   Each has a short title and two lines of copy.
3. **Pricing.** Three tiers — Free, Team, Enterprise — with a price, three bullet
   points each, and a button. The middle tier is the recommended one and must be
   visually distinguished from the other two.
4. **Testimonial.** One quotation, an attributed name, and a role.
5. **Footer.** Three columns of links and a copyright line.

## Required hooks

The page MUST carry these ids, on the elements described. They are how the page is
measured; how you style them is entirely up to you.

| id | on |
|---|---|
| `hero` | the hero section |
| `hero-title` | the product name or headline inside it |
| `cta` | the hero's primary call-to-action |
| `feature-card` | the FIRST of the three feature cards |
| `price-highlight` | the recommended (middle) pricing tier |
| `price-plain` | either of the other two pricing tiers |
| `quote` | the testimonial quotation |
| `footer` | the footer |

Only the first feature card and one plain tier need an id. The others should exist
but need no hook.

## Both light and dark

The page must work in light and dark. Do not write a separate dark-mode design —
the dark rendering should follow from however your substrate handles theming.

## What "done" looks like

`index.html` plus your own stylesheet, in the directory you were given. It must
render standalone from `file://` with no server and no build step. Do not edit
anything outside your directory.
