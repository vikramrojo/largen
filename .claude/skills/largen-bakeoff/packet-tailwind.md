# Arm B — build it with Tailwind

You are one of two agents building the same page from the same brief. The other is
using a different substrate. You will not see its work and it will not see yours.

## Your substrate

Tailwind CSS, loaded from the browser CDN. Put this in `<head>`:

```html
<script src="https://cdn.tailwindcss.com"></script>
```

That gives you utility classes with no build step. You may add a `<style>` block or
a `styles.css` for anything Tailwind does not cover, and you may configure Tailwind
inline via `tailwind.config` if you want theme tokens.

You are given no reference documentation, deliberately — you already know Tailwind.
The other arm is given its substrate's full contract because that substrate is new
and unknown to you both. This imbalance is recorded in the results; it is not an
oversight and it is not something for you to correct.

## What to write

- `index.html` — the page
- `styles.css` — optional, only if you need it

## Both light and dark

Tailwind's dark mode is class-based. Set it up so the page renders in dark when the
root element carries `class="dark"`, using `darkMode: 'class'`. Do not build a
separate dark design; use `dark:` variants.

## Constraints

Write only inside your own directory. Do not run git. Do not install anything —
the CDN script is the whole dependency.
