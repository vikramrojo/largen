---
name: largen-bakeoff
description: Run a repeatable head-to-head where two subagents build the same landing page simultaneously — one on largen, one on Tailwind — then score and screenshot both. Use when comparing largen as an authoring substrate, or when you want evidence rather than an argument.
---

Two agents. One brief. One model. Two substrates. Everything after generation is
arithmetic, and none of it runs a model.

## What this measures, and what it cannot

`largen eval` scores conformance to largen's authoring contract. Pointing it at the
Tailwind arm would report zero for every metric, because a Tailwind page has no
`@layer largen.components` and no slots — a number that looks like a rout and
measures nothing. So there are two instruments and the summary says which is which:

| instrument | measures | arms |
|---|---|---|
| `emit_probe` | computed styles in a real browser | **both** — it does not care how they got there |
| `largen eval` | conformance to largen's rules | largen only, reported not compared |

**No winner is declared.** The largen arm is handed `llms-compact.txt` because it
must be; largen is absent from training data. The Tailwind arm needs nothing,
because the model already knows Tailwind. A largen win is conservative; a largen
loss is confounded. The summary states this every run.

## Run it

**1. Make the run directory.**

```bash
RUN=.claude/skills/largen-bakeoff/runs/$(date +%Y%m%d-%H%M)
mkdir -p "$RUN"/largen "$RUN"/tailwind
cp .claude/skills/largen-bakeoff/brief.md "$RUN"/largen/
cp .claude/skills/largen-bakeoff/brief.md "$RUN"/tailwind/
cp .claude/skills/largen-bakeoff/packet-largen.md "$RUN"/largen/PACKET.md
cp .claude/skills/largen-bakeoff/packet-tailwind.md "$RUN"/tailwind/PACKET.md
cp site/public/llms-compact.txt "$RUN"/largen/
cp dist/largen.css dist/theme-dark.css "$RUN"/largen/
```

`theme-dark.css` matters. It is a separate file and the only place the dark tokens
live, so an arm given `largen.css` alone cannot satisfy the brief's dark-mode
requirement. An early version of this harness made that mistake and the arm's two
screenshots came out byte-identical — an unfair packet that would have read as a
largen loss.

**2. Spawn both agents at once**, same model, `bypassPermissions`, each pointed at
its own directory:

> Read `brief.md` and `PACKET.md` in your directory and build what they describe.
> Write only inside your own directory. Do not run git. Do not install anything.

Hold the model fixed across arms — that is the entire design. Which model it is
does not change the method.

**3. Score and shoot**, once both finish:

```bash
node .claude/skills/largen-bakeoff/run.mjs "$RUN"
```

Reads `summary.md` and `report.json` into the run directory, with
`shot-light.png` / `shot-dark.png` per arm.

## What the harness does that is not obvious

- **Derives the load order from the HTML.** A candidate links two stylesheets and
  has no CSS entry point, so `eval`'s cascade check — the most valuable thing it
  does — reports `NOT RUN`. Parsing the `<link>` order and writing an `_entry.css`
  of `@import`s takes it from `NOT RUN` to 39 declarations checked. The HTML *is*
  the load order.
- **Serves each arm over HTTP for the probe.** A `file://` iframe is cross-origin
  to a `file://` parent, so `contentDocument` throws and the probe silently reports
  nothing. The first run of this harness returned `0/0 compared` for both arms.
  Screenshots stay on `file://`; only the probe needs an origin.
- **Drives each substrate's own theme lever.** largen themes by `data-theme`,
  Tailwind by `class="dark"`. Setting the wrong one succeeds and changes nothing,
  which returns the page's own theme under the label of the one requested — the
  failure largen 0.3.2 was released to fix.

## Before trusting a result

The fixtures are the harness's own test. Run them and confirm the numbers move in
the right direction:

```bash
rm -rf /tmp/bake-good /tmp/bake-bad
cp -r .claude/skills/largen-bakeoff/fixtures/good /tmp/bake-good
cp -r .claude/skills/largen-bakeoff/fixtures/bad  /tmp/bake-bad
node .claude/skills/largen-bakeoff/run.mjs /tmp/bake-good
node .claude/skills/largen-bakeoff/run.mjs /tmp/bake-bad
```

| | good | bad |
|---|---|---|
| largen colour literals | 0 | 11 |
| largen theme survival | 22/56 | 4/56 |
| tailwind theme survival | 13/56 | 0/49 |
| missing hooks | none | 1 |

If the bad fixtures score like the good ones, the instrument is broken and any real
run is an anecdote.

## The brief mandates ids, not classes

`#hero`, `#cta`, `#feature-card`, `#price-highlight`, `#quote`, `#footer` and the
rest. That is what makes one probe config target both arms: how a substrate styles
`#hero` is its own business, but both must have one. Without it there is no way to
ask the two pages the same question.

## Reading the result

Conformance is not appearance. Every number can be perfect on a page that looks
wrong — that is what the screenshots are for, and why they are taken in both themes.

An element whose measured properties are identical in light and dark is either
deliberately theme-invariant or not themed at all. The summary lists them; it
cannot tell you which, and does not pretend to.
