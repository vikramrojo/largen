---
name: largen-bakeoff
description: Run a repeatable head-to-head where two subagents rebuild the same two screens from the same reference images simultaneously — one on largen, one on Tailwind — then score and screenshot both. Use when comparing largen as an authoring substrate, or when you want evidence rather than an argument.
---

Two agents. Two reference images. One model. Two substrates. Everything after
generation is arithmetic, and none of it runs a model.

## The task is replication, not invention

Both arms get the same two PNGs in `target/` and are asked to rebuild them: a dark
landing hero, and a content band of partner marks, a two-tone statement and three
oversized stat rows. Neither arm gets the URL, the markup or the CSS.

That is a deliberate change from a written brief. A brief lets each substrate drift
toward what it finds easy, and the two pages end up incomparable for reasons that
have nothing to do with the substrate. A fixed image gives both arms the same
target and makes the gap between intent and output visible — which is the thing
worth measuring about an authoring substrate.

The reference is dark. `shot-*-dark.png` is what you compare against `target/`;
`shot-*-light.png` is whatever each substrate's theming does with a design nobody
drew light. That second rendering is free evidence and costs the arms nothing,
which is the point of asking for it.

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
SKILL=.claude/skills/largen-bakeoff
RUN=$SKILL/runs/$(date +%Y%m%d-%H%M)
mkdir -p "$RUN"/largen "$RUN"/tailwind
for arm in largen tailwind; do
  cp "$SKILL"/brief.md "$RUN"/$arm/
  cp "$SKILL"/target/screen-1-landing.png "$SKILL"/target/screen-2-content.png "$RUN"/$arm/
done
cp "$SKILL"/packet-largen.md   "$RUN"/largen/PACKET.md
cp "$SKILL"/packet-tailwind.md "$RUN"/tailwind/PACKET.md
cp site/public/llms-compact.txt "$RUN"/largen/
cp dist/largen.css dist/theme-dark.css "$RUN"/largen/
```

**Both arms get both images.** They are the brief. An arm that cannot see them is
being asked to invent a design and then scored on how close it landed to one it was
never shown.

`theme-dark.css` matters. It is a separate file and the only place the dark tokens
live, so an arm given `largen.css` alone cannot satisfy the brief's dark-mode
requirement. An early version of this harness made that mistake and the arm's two
screenshots came out byte-identical — an unfair packet that would have read as a
largen loss.

**2. Spawn both agents at once**, same model, `bypassPermissions`, each pointed at
its own directory:

> Read `brief.md` and `PACKET.md` in your directory, look at
> `screen-1-landing.png` and `screen-2-content.png`, and rebuild both screens.
> Write only inside your own directory. Do not run git. Do not install anything.

Hold the model fixed across arms — that is the entire design. Which model it is
does not change the method.

**3. Score and shoot**, once both finish:

```bash
node .claude/skills/largen-bakeoff/run.mjs "$RUN"
```

Writes `summary.md` and `report.json` into the run directory, and four screenshots
per arm — `shot-index-{light,dark}.png` and `shot-content-{light,dark}.png`.

## What the harness does that is not obvious

- **Derives the load order from the HTML.** A candidate links two stylesheets and
  has no CSS entry point, so `eval`'s cascade check — the most valuable thing it
  does — reports `NOT RUN`. Parsing the `<link>` order and writing an `_entry.css`
  of `@import`s takes it from `NOT RUN` to 65 declarations checked on the good
  fixture. The HTML *is* the load order.
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
| largen colour literals | 0 | 19 |
| largen theme survival | 43/152 | 9/144 |
| tailwind theme survival | 25/152 | 0/144 |
| missing hooks | none | 1 per arm |
| `largen eval` on the largen arm | clean, 65 declarations checked | refuses — no `@layer largen.components` |

If the bad fixtures score like the good ones, the instrument is broken and any real
run is an anecdote.

The bad largen arm makes `largen eval` fail rather than score badly, and that is
correct: its stylesheet opens no layer, so there are no largen components to
evaluate. The summary prints the refusal. A tool that invented a low number there
would be worse than one that declines.

The good fixture is not a handsome page and is not trying to be. It exists so the
harness has an input that should come back clean, and it does one thing on purpose:
`--pad` in `em`, `--gap` on the rem `--space-*` scale. An earlier version used rem
for both and tripped largen's own `pad-in-rem` warning seven times — a fixture named
`good` that fails the contract is not a fixture, it is a bug.

## The brief mandates ids, not classes

`#hero-title`, `#eyebrow`, `#statement-muted`, `#stat-value` and the rest, listed in
`probe.json`. That is what makes one probe config target both arms: how a substrate
styles `#hero` is its own business, but both must have one. Without it there is no
way to ask the two pages the same question.

`probe.json` lists selectors **per page**, not once. The two screens share no hooks,
so a single run would ask `index.html` for `#stat-value`, get `missing`, and report
every second-screen hook as a hole in a page that is entirely correct.

## Reading the result

**Nothing in the report scores fidelity to the reference.** The probe reads what a
browser resolved; it cannot tell you whether the headline is the right size or the
stat rows sit on the right rhythm. Put `shot-index-dark.png` and
`shot-content-dark.png` beside the two PNGs in `target/` and judge that by eye. It
is the one part of this that is not arithmetic, and automating it badly would be the
easiest way to make the harness lie.

Conformance is not appearance either. Every number can be perfect on a page that
looks wrong — that is what the screenshots are for, and why they are taken in both
themes.

An element whose measured properties are identical in light and dark is either
deliberately theme-invariant or not themed at all. The summary lists them; it
cannot tell you which, and does not pretend to.

## Refreshing the reference

`node .claude/skills/largen-bakeoff/target/capture.mjs` re-shoots both screens from
the live site. See `target/SOURCE.md` for why it drives Chrome over CDP instead of
using `--screenshot`, and note that a refresh against a third-party page that has
changed invalidates comparison with every run recorded before it.
