# Tasks

## 1. The scale

- [x] 1.1 `--space-1` … `--space-24` in `src/tokens.css`, nine steps on 0.25rem.
      Run 2 of the bake-off chose this granularity unprompted, which is reasonable
      evidence it is the right one.
- [x] 1.2 Comment records the unit decision and the measured numbers behind it.
- [x] 1.3 Confirm no collision with any registered slot.

## 2. The rule

- [x] 2.1 `pad-in-rem` in `genai/lint.js`, following the existing
      `add(rule, severity, line, message, why)` shape.
- [x] 2.2 Warning, not error — fixed padding is sometimes deliberate.
- [x] 2.3 `--pad` only. `--gap` is legitimately absolute and is what the scale is for.
- [x] 2.4 Validated against the real defect: 8 warnings on bake-off run 2, which
      used the rem scale for `--pad` in 8 places; 0 on run 1; 0 on largen itself.

## 3. Composition in the contract

- [x] 3.1 `COMPOSITION` in `site/mcp/contract.mjs` — space and the unit rule,
      elevation with restraint, what a slot cannot express, contrast on toned
      surfaces, and what "loud is relative" means.
- [x] 3.2 Registered in `SECTIONS` so `get_contract({section:'composition'})` serves it.
- [x] 3.3 Rendered in full into `SKILL.md` and `llms-compact.txt`. Full, not a
      pointer: the measured improvement was of the material being in the prompt.
- [x] 3.4 `llms.txt` links it.

## 4. Two more failure modes

- [x] 4.1 A gradient set through `--bg` paints nothing, silently.
- [x] 4.2 Padding in rem stops responding to `data-size`.
- [x] 4.3 Taxonomy goes from eight to ten; both were found by measurement this week.

## 5. The budget

- [x] 5.1 16kb → 24kb in `skill/scripts/contract.mjs`.
- [x] 5.2 The comment records the evidence: composition guidance is ~4kb, there were
      463 bytes of headroom, and the material demonstrably changed the output.
- [x] 5.3 The check and its warning stay. Proved it still fires by temporarily
      lowering the limit to 8kb.

## 6. Verify

- [x] 6.1 `site/test/size-axis.mjs` — the measurement as a test: type resizes, em
      padding follows, rem padding does not, and the rule fires on exactly the
      right cases.
- [x] 6.2 **It passed for the wrong reason first.** rem padding read `0px at every
      size` because `dist/largen.css` had not been rebuilt, so `var(--space-2)`
      resolved to nothing. Rebuilt; it now reads the real `8px 16px`. A test whose
      number is the argument has to be read, not just watched go green.
- [x] 6.3 Full suite: 78 MCP, 17 discovery, 11 cascade-diff, 9 probe-theme,
      9 verify-cascade, 15 matrix, 11 conformance, 4 size-axis.
- [x] 6.4 `contract --check` current; budget under 24kb at 18.09kb.
- [x] 6.5 Bump, freeze, deploy. First CSS change since 0.3.0 — build id moves
      `b9fc348c` → `5445bbba`.
- [x] 6.6 Re-run the bake-off with the shipped contract and NO addendum —
      `runs/20260824-1112`. The composition section carried it: 0 colour literals,
      100 declarations checked with 0 cascade findings, 0 axis findings, 0 missing
      hooks, and a page with real rhythm and readable contrast, from `llms-compact.txt`
      alone. No addendum was supplied and none was needed.

      **Two caveats on how much this proves.** The brief changed in the same step
      — it is now image replication across two screens, not the written Kettle
      brief — so this is not a clean A/B against runs 1 and 2, and the comparison
      is qualitative. And the arm still wrote `--pad` in rem 8 times; the
      difference from run 2 is that all 8 are layout patterns (`.shell` `.nav`
      `.hero` `.social` `.partners` `.about` `.stats` `.stat-row`) and both
      components that take padding use `em`. That is the split the contract now
      teaches, arrived at unprompted, and the agent named the warnings as
      intentional rather than tripping over them silently. The `pad-in-rem` rule
      firing 8 times on correct code is the cost of it being a warning, which is
      why it is one.

## Recorded, not acted on

`var(--scale)` is consumed 18 times in the reference components and 0 times in
`src/layout.css` and `src/elements.css`. The size axis spans ±25% and ~20 of 32
components abstain from it entirely. That is a real observation about one of four
headline axes, and it is what made this design one scale rather than two: patterns
never see `--scale`, so pattern spacing has no reason to be relative.

Whether a type-only multiplier that most components ignore has earned its place
beside tone and variant is a larger question than a spacing scale, and is not
settled here.

---

# Wave 2 — make each claim able to fail

Wave 1 shipped as 0.4.0 and the bake-off re-ran on it with no addendum. Of the
five composition topics, one changed the output: the only one with a verifier.
`runs/20260824-1112` is the evidence and stays on disk.

## 7. Document the utilities

- [x] 7.1 Replace the bare `UTILITIES stack row cluster center grid switcher
      sidebar` line in `site/mcp/contract.mjs` with a block giving each utility
      what it does and the properties it reads. `src/layout.css` already documents
      all of it in comments — this is transcription. **Came out 1,537 bytes, not
      the ~500 estimated.** The estimate predated finding that `data-align` and
      `data-justify` are undocumented too — the arm hand-wrote 15 `align-items`
      and 10 `justify-content`, all covered by shipped attributes nobody
      documented. Kept: it closes the largest measured hole and the budget has
      4,057 bytes free at 20,519 of 24,576.
- [x] 7.2 Say that utilities are configured by custom properties the same way
      components are. That is the point the bare list loses, and it is why the
      bake-off arm read seven class names and hand-wrote `display:flex` ten times.
- [x] 7.3 Regenerate every surface and confirm `contract --check` is clean and the
      compact file is still under 24kb. Now 20,519 of 24,576. Both renderers
      gained exactly once — checked by counting the heading in each, because the
      wave-1 equivalent hit the first of two identical anchors and put the section
      in `SKILL.md` twice and `llms-compact.txt` not at all. `largen pages` also
      needed regenerating; `contract --check` catches that.

## 8. The gradient: reframe, then enforce

- [x] 8.1 Move the gradient recipe out of *What a slot cannot express* into a
      positive topic in `COMPOSITION`. Filed under failure it reads as *avoid
      gradients*, which is how it was followed: zero uses against a working snippet.
      Renamed `beyond` → `depth`, titled *Depth: write the slot, then the plain
      property*, and the example is now the ambient two-radial wash the reference
      actually uses rather than a single decorative sweep. The generalisation
      ("the same shape covers anything the slots miss") moved to the last line,
      where it belongs, instead of framing the whole topic.
- [x] 8.2 Add a `slot-gradient` warning to `genai/lint.js`, following the existing
      `add(rule, severity, line, message, why)` shape. Fire when `--bg` takes a
      `linear-gradient` / `radial-gradient` / `conic-gradient`; the `why` carries
      the write-the-slot-then-the-plain-property pattern.
- [x] 8.3 Keep the vanishing gradient in `FAILURE_MODES`. The recipe moves; the
      hazard stays recorded.
- [x] 8.4 Prove it fires and clears — `site/test/composition-rules.mjs`, 6 tests.
      Fires on all four gradient functions through `--bg` and on `--fg`; clears on
      the documented pattern, on `--shadow`, on `--transition` and on a plain
      token. Regression: 0 findings on largen's own 32 components and 0 on all
      three bake-off runs — expected, since none of them wrote a gradient at all,
      which is the finding this wave exists to change.

## 9. Verifiers for the remaining claims

- [x] 9.1 A section-rhythm check — `lintPageHtml()` in `genai/lint.js`, wired into
      `verify`'s `--entry` HTML path, which was already reading that file for its
      `<link>` order. Rhythm is not a property of any stylesheet: it is about a
      container and its children, and the container is in the document. Counts
      top-level sections only, and clears on any of three levers (a `stack`/`grid`
      class on body, an inline `--gap`, or `--gap` on body in CSS). Landed as
      `info` rather than `warning` — a page can space its sections another way,
      and the rule can only say the obvious lever is unused.
- [x] 9.2 `layout-by-hand`, an `info`. **There was no `info` severity** — `verify`
      rendered everything non-error as `note` and counted it as a warning, so a
      reuse suggestion would have inflated the warning count. Added the level:
      renders as `hint`, counted separately. Requires flex *plus* alignment or a
      gap, so bare `display:flex` with hand-managed children stays silent.
- [x] 9.3 **It names the utility.** The condition was that it be right on the
      bake-off's hand-rolled flex rules, and it is: `flex-direction: column` →
      `stack`, `flex-wrap: wrap` → `cluster`, otherwise `row`, correct on all 9
      it fires on in run 3 and on run 1's 2. A suggestion that does not say what
      to use instead is not actionable, and one that names the wrong thing teaches
      an author to stop reading hints — so it only names when unambiguous.
- [x] 9.4 Regression across all three runs, **encoded as tests** in
      `site/test/composition-rules.mjs` (11 passing) rather than run once by hand.
      `section-rhythm` fires on run 1 and clears on runs 2 and 3, matching the
      visual judgement. `layout-by-hand` gives run 1 two hints and run 3 nine —
      run 3 is the better page and gets more hints, which is correct: it wrote
      more layout, and all of it by hand.
      **Gap noted, not fixed here:** the auxiliary test files have no aggregator
      and are not listed in `DEPLOY.md`. A test nobody runs is a test that does
      not exist, and this change adds one more to that pile.

## 10. Axis guidance

- [x] 10.1 A short topic in `COMPOSITION` on when to reach for tone, size and
      state. Run 3 used `data-tone` 0 times, `data-size` 0 times and `var(--scale)`
      0 times — three of four headline axes untouched, on a design where an author
      would reasonably assume tone was not for them. Landed as a topic saying the
      test for tone is "does a group vary together", not "is this colourful" —
      and saying plainly that size is narrower, because `--scale` is a component
      concern and a hero has nothing to scale against. That admission is the same
      finding wave 1 recorded and declined to act on.

## 11. The size axis moves to the renderer

- [x] 11.1 **Do not retry the static narrowing.** Gating `pad-in-rem` on the rule
      also setting `--font-size` was implemented against both runs and rejected: it
      clears all 8 correct rules in run 3 and all 8 offending rules in run 2,
      `.feature-card` and `.price-tier` included. The signal is not in the rule body.
- [x] 11.2 `largen probe --size-axis --page <file> --select …`. Takes a page, not
      a dir. Confirmed the theme loop could NOT be reused: `conflictingSignal`
      hardcodes `light`/`dark` into its vocabulary and scans every attribute for a
      matching value, so a page carrying `data-theme="dark"` makes every `sm`/`xl`
      reading refuse — correctly, by its own rules. Side-by-side fixture instead,
      with the page's `<link>` tags carried over and a `<base>` so it serves from
      anywhere. Verified the wrapper works: `--scale` reads 0.875 under sm and
      1.25 under xl.
- [x] 11.3 `sizeAxisVerdict()` in the probe runtime pairs the two wrappers back up
      and emits a table plus `out.sizeAxis` in the JSON. It reports which
      properties are stuck and at what value, and says in the note that it cannot
      tell deliberate from broken — that is an intention, and no measurement
      recovers an intention. Naming the stuck value is what lets a reader decide.
- [x] 11.4 Leave `pad-in-rem` a warning, and make its `why` say it is a heuristic
      and name the rendered check as authoritative.
- [x] 11.5 **The expectation in this task was wrong, and the tool is what showed
      it.** Run 2 is stuck, as predicted. Run 3 is stuck too — and it should not
      have been, since every component in it uses `em` padding and passes
      `pad-in-rem` clean.

      The cause: run 3 consumes `var(--scale)` **zero times**. `em` padding is
      relative to a font-size that nothing scales, so it cannot move. Both runs
      are outside the size axis entirely and static analysis called both clean.

      That is a stronger result than the one this task asked for: the renderer did
      not merely confirm a known bug, it found a live one that every static check
      passes. Control case proves the tool is not just always saying "stuck" —
      `.badge` from `components/reference.css`, which sets
      `--font-size: calc(0.78rem * var(--scale))`, reports padding 1.638px → 2.34px
      and font-size 10.92px → 15.6px, both following.

      Encoded in `site/test/size-axis.mjs` as *em padding alone does NOT put a
      component on the size axis*, with the fixture's own scaling component as the
      control.

## 12. Verify

- [x] 12.1 **The real test — run 4 (`runs/20260824-1537-docs`), documentation
      changed and nothing else.** Only the largen arm was re-run; nothing in the
      Tailwind packet changed, so re-running it would have spent a model to
      reproduce a number already on disk. All three predictions hit:

      | prediction | run 3 | run 4 |
      |---|---|---|
      | hand-written `display:flex` | 10 | **3** |
      | `background-image` / gradient | 0 | **3** |
      | plain-property share | 48% | **45%** |

      Not predicted, and larger than what was:

      | | run 3 | run 4 |
      |---|---|---|
      | `justify-content` by hand | 10 | **0** |
      | `align-items` by hand | 15 | **5** |
      | `data-align` / `data-justify` | 0 | **12** |
      | `layout-by-hand` hints from `verify` | 9 | **0** |

      The alignment attributes went from never-used to used twelve times. They
      were undocumented on every surface before this wave, which is why.

      The gradient is the one the contract teaches, tokens and all:
      `radial-gradient(60rem 36rem at 12% 8%, var(--shade), transparent 70%)` —
      two washes, `--shade` on every stop, 0 colour literals. The flat hero that
      lost to Tailwind in run 3 is gone.

      The 3 remaining `display:flex` are `.nav-group` and `.social`, neither of
      which any shipped utility covers. The rule correctly stays silent on them.
- [x] 12.2 **The null result: §10 did not work.** `var(--scale)` is still consumed
      0 times and `data-tone` still appears 0 times. The axis topic was written
      for exactly this and changed nothing measurable.

      It is the only §7–§11 item that shipped **without a verifier**, which is the
      finding this whole wave is built on, arriving again at its own expense. The
      four items with a rule behind them all moved.

      A caveat that cuts the other way: this run is one agent on one brief, and
      the four successful items are confounded with each other — they shipped
      together and no run separates them. The direction is strong and the
      attribution is not clean.

      Second caveat, from §11.5: run 4 still consumes `var(--scale)` zero times,
      so its components remain outside the size axis. The page got visibly better
      and that specific defect did not move.
- [x] 12.3 Full suite: **77/78 MCP** (the one failure is `releases --check`
      demanding a bump — task 12.5, the guard working), 17 discovery, 11
      cascade-diff, 9 probe-theme, 9 verify-cascade, 15 matrix, 11 conformance,
      6 size-axis (up from 4), **11 composition-rules (new)**.
      `discovery.mjs` needs `node server.mjs` on :8787 or it dies on a refused
      connection rather than skipping — pre-existing, noted not fixed.
- [x] 12.4 `contract --check` clean across all 7 surfaces, `pages --check` across
      all 11. It caught two forgotten `largen pages` regenerations during this
      wave, which is the whole reason it exists.
- [x] 12.5 **0.5.0**, frozen at `/v/0.5.0/`. Six shipped files changed —
      `genai/lint.js`, `genai/probe.js`, `skill/scripts/{contract,probe,verify}.mjs`,
      `skill/SKILL.md`. **No CSS change**, so the build id stays `5445bbba` and
      vendored copies are unaffected: this is a tooling and contract release, and
      the entry says so.
      `releases --check` demanded the bump before it was made (MCP suite 77/78);
      78/78 after. Not deployed and not published — that is a separate decision.
