# Where these came from

`https://craift.pages.dev/` — a dark agency landing page, captured 2026-08-24 at
1280 CSS px, device scale 1, by `capture.mjs` in this directory.

| file | what it is |
|---|---|
| `screen-1-landing.png` | the landing hero, viewport 1280×860, top of page |
| `screen-2-content.png` | the partners strip through the first stat row, 1280×1180 |

## Why there is a capture script

The obvious command does not work. The site pins its hero and reveals every later
section on scroll, so:

- a tall `--window-size` capture returns the hero repeated, not the page;
- `--disable-javascript` renders the server HTML with every section empty;
- `--force-prefers-reduced-motion` does not disable the reveal.

The only capture that reaches the content section is one that actually scrolls, so
`capture.mjs` drives Chrome over the DevTools protocol, walks the full page height
to fire every reveal, then finds the section by its copy rather than by a class
name the site is free to rename. It has no dependencies — Node's built-in
`WebSocket` speaks CDP directly.

## Standing of these files

They are the reference of record. Neither arm is given the URL, the markup, or the
CSS; both are given these PNGs and the copy, and asked to rebuild what they can
see. Re-running `capture.mjs` refreshes them against a third-party site that may
have changed, and a refresh that moves the target invalidates comparison with runs
recorded before it.

The design is dark. That is the rendering both arms are matching; the light
rendering is whatever each substrate's own theming produces, which is the point of
asking for it.
