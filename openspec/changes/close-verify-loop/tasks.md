# Tasks

## 1. The cascade, across files

- [x] 1.1 `checkComponentsApply()` in `genai/cascade.js` — for every slot a
      component sets, resolve whether that declaration wins on an element matching
      its own selector.
- [x] 1.2 `synthesizePath()` — a selector to an ancestor chain, returning null for
      anything a chain cannot represent rather than inventing an element the rule
      would not match.
- [x] 1.3 Wire both into `largen verify`, with `checkLayerOrder` across the same
      derived order.

## 2. Load order, without guessing

- [x] 2.1 `--entry`, and inference when exactly one discovered stylesheet imports
      others and is imported by none.
- [x] 2.2 Report NOT RUN with the reason when neither works.
- [x] 2.3 Report imports that were not among the files checked.
- [x] 2.4 Include minified bundles in the cascade set and keep excluding them from
      linting.

## 3. Two defects the check found in the tools it uses

- [x] 3.1 `orderFromImports` appended a file after its imports, losing the `@layer`
      statement that legally precedes them — so largen's own layer order resolved
      wrongly and the check called it unachievable. Leading statements are now
      emitted where the browser sees them.
- [x] 3.2 Comments were stripped rather than blanked, so an offset into the cleaned
      text sliced the wrong part of the original. largen's stylesheets open with a
      24-line comment, so the prelude came back empty.
- [x] 3.3 `synthesizePath` read only the first functional pseudo, so
      `:where(ol, ul):is(.stack, .row)` gave an `<ol>` with no class.
- [x] 3.4 `--entry`'s value was collected as a file to lint by a naive
      "not a flag" filter.

## 4. Stop reporting what a repair cannot clear

- [x] 4.1 A stylesheet that sets slots inside a layer of its own is framework CSS,
      not a component that forgot its layer. The heuristic existed because nothing
      could evaluate the real question; `checkComponentsApply` evaluates it now.
- [x] 4.2 A stylesheet that sets slots and opens no layer at all is still caught.

## 5. Say what was checked

- [x] 5.1 Replace "all static checks passed / static only" with what ran and what
      did not.
- [x] 5.2 Update the contract's command caveat, which told agents "All of it is
      static". Confirm `llms-compact.txt` stays inside its 16kb budget.

## 6. Verify

- [x] 6.1 `site/test/verify-cascade.mjs` — 7 assertions, run through the CLI on
      scratch projects, because the bug only exists between files.
- [x] 6.2 The repair half: applying the guidance the finding gives makes it pass.
      A verifier that only ever fails is not a loop.
- [x] 6.3 Assert no finding survives a correct repair.
- [x] 6.4 Assert the checks decline rather than guess when the order is ambiguous.
- [x] 6.5 All suites: 78 MCP, 17 discovery, 11 cascade-diff, 9 probe-theme,
      7 verify-cascade. `contract --check` and `releases --check` clean.
- [ ] 6.6 Run against the deployed origin after shipping.
