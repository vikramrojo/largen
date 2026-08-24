/* largen — the axis matrix.
 *
 * WHY THIS EXISTS
 *
 * "Every component gets four axes for free" is the library's central claim, and
 * until this file it had never been checked, only stated. See
 * openspec/changes/conformance-and-eval/design.md, "Split the matrix by question,
 * not by cost", for the reasoning this file implements.
 *
 * TWO QUESTIONS, NOT ONE
 *
 *   Does the axis reach the component's slot?   resolveProperty, no browser.
 *   Does it resolve to a DIFFERENT value?        needs var() substitution and
 *                                                 color-mix() — needs a browser.
 *
 * These are not the same question and this file only answers the first one. The
 * two axes behave differently under it, for a structural reason:
 *
 *   variant competes for the SAME slot the component set (`--bg`, `--fg`,
 *   `--border-color`, `--border-width`), from a layer that sorts after
 *   `largen.components`. So when `data-variant` is present, the WINNING
 *   DECLARATION itself changes — from the component's own rule to the
 *   modifier's. `resolveProperty` proves that directly: run it once without the
 *   attribute and once with, and compare which rule won.
 *
 *   tone, size and theme never do that. A component reads them through
 *   indirection — `--bg: var(--tone-soft)`, `--font-size: calc(1rem *
 *   var(--scale))` — and `resolveProperty` deliberately does not substitute
 *   var() (see genai/cascade.js's header). The component's own declaration
 *   wins whether or not `data-tone` is set; only the SUBSTITUTED VALUE would
 *   differ, and proving that needs an engine. What IS available without one is
 *   the winning declaration's raw, unsubstituted text — and whether it
 *   references a property that these axes are known to drive. That is a
 *   syntactic fact, not a resolved value, and it is exactly the "reach"
 *   question: a component whose winning declaration never mentions `--tone`,
 *   `--tone-soft`, `--tone-ink`, `--tone-line` or `--tone-contrast` cannot
 *   respond to tone no matter what a browser would show, because nothing in
 *   its own rule ever asks for it.
 *
 * So this file does NOT re-run resolveProperty across a data-tone/data-size/
 * data-theme attribute the way it does for variant — a component's own
 * declaration would win in both cases, and the comparison would always read
 * "unreached" even for `.dot { --bg: var(--tone) }`, which plainly responds to
 * tone. It runs resolveProperty ONCE per slot, and checks the winning value's
 * text against a vocabulary of axis-driven custom properties. That vocabulary
 * is not hand-written either — see buildReferenceGraph below — because a
 * hand-written list is exactly the kind of thing this repository has watched
 * go stale (skill/scripts/pages.mjs has the running total).
 *
 * WHY AXES VALUES ARE DERIVED, NOT LISTED
 *
 * genai/manifest.json already carries a `tone`/`variant`/`size` value list, and
 * it is hand-authored — its own header says so. Re-typing that list here would
 * be a second copy of something already capable of drifting from the CSS that
 * actually enforces it. So AXES below is read directly out of src/algebra.css's
 * `:where([data-tone="…"])` selectors — the same rules the cascade obeys — and
 * out of the themes/ directory for which themes exist. If a tone is renamed in
 * one place and not the other, this file notices by construction rather than by
 * someone remembering to update three files at once.
 *
 * This is the one module under genai/ that touches the filesystem at import
 * time. Every sibling here (cascade.js, probe.js, lint.js, validate.js) is
 * isomorphic — validate.js is fetched straight into a browser by
 * site/public/play.html — and that purity is worth keeping. This file breaks it
 * on purpose: its whole job is "derive the axis vocabulary from the files that
 * define it," and nothing currently serves this module to a browser. If that
 * changes, AXES should become a function the caller feeds file contents to, the
 * same shape checkAxisReach already takes.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { orderFromImports } from './layers.js'
import {
  maskComments, parseStylesheet, splitTopLevel, splitCombinators, parseCompound,
  synthesizePath, resolveProperty,
} from './cascade.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Every `[attr="value"]` literal used in one stylesheet's RULES, in first-seen
 *  order. Comments are masked first — algebra.css's own prose uses
 *  `data-tone="danger"` as a worked example before the rule that defines it,
 *  and reading comments would derive an order (and, on a stray typo, a value)
 *  the CSS itself never enforces. */
function attributeValues(css, attr) {
  const re = new RegExp(`\\[${attr}="([\\w-]+)"\\]`, 'g')
  const out = []
  for (const m of maskComments(css).matchAll(re)) if (!out.includes(m[1])) out.push(m[1])
  return out
}

const algebraCss = readFileSync(join(ROOT, 'src/algebra.css'), 'utf8')

/* 'light' first because it is the default theme (src/tokens.css sets
   color-scheme: light with no attribute needed) — an arbitrary filesystem
   listing order would be a needless source of non-determinism in output that
   gets diffed and read by people. */
const THEME_PRIORITY = ['light', 'dark']
const themeNames = readdirSync(join(ROOT, 'themes'))
  .filter((f) => f.endsWith('.css'))
  .map((f) => f.replace(/\.css$/, ''))
  .sort((a, b) => {
    const ia = THEME_PRIORITY.indexOf(a), ib = THEME_PRIORITY.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

export const AXES = {
  tone: attributeValues(algebraCss, 'data-tone'),
  variant: attributeValues(algebraCss, 'data-variant'),
  size: attributeValues(algebraCss, 'data-size'),
  theme: themeNames,
}

/** Every {tone, variant, size, theme} combination — 7 × 4 × 5 × 2 = 280. */
export function axisCombinations() {
  const out = []
  for (const tone of AXES.tone) {
    for (const variant of AXES.variant) {
      for (const size of AXES.size) {
        for (const theme of AXES.theme) out.push({ tone, variant, size, theme })
      }
    }
  }
  return out
}

/* --- the axis vocabulary ---------------------------------------------------
 *
 * "Which custom properties does this axis drive?" answered by reading the
 * files, not by asserting it. `[data-tone="X"]` rules set `--tone` and
 * `--tone-contrast` directly; a property "is tone vocabulary" if it is one of
 * those OR if its own declared value references one of those (`--tone-soft`
 * reads `var(--tone)`) — computed as the transitive closure of a reference
 * graph built from every declaration in the given files, so a third level of
 * indirection is still found without anyone having to add it by hand.
 */

const CUSTOM_PROP = /^--/
const VAR_REF = /var\(\s*(--[\w-]+)/g

/** propertyName -> Set(names of properties whose value references it). */
function buildReferenceGraph(rules) {
  const referencedBy = new Map()
  for (const rule of rules) {
    for (const decl of rule.declarations) {
      if (!CUSTOM_PROP.test(decl.property)) continue
      for (const m of decl.value.matchAll(VAR_REF)) {
        const ref = m[1]
        if (!referencedBy.has(ref)) referencedBy.set(ref, new Set())
        referencedBy.get(ref).add(decl.property)
      }
    }
  }
  return referencedBy
}

/** Custom properties declared directly inside a rule whose selector names
 *  `attr` — e.g. every property `:where([data-tone="danger"])` sets. */
function seedProperties(rules, attr) {
  const seed = new Set()
  for (const rule of rules) {
    if (!rule.selector.includes(attr)) continue
    for (const decl of rule.declarations) if (CUSTOM_PROP.test(decl.property)) seed.add(decl.property)
  }
  return seed
}

/** seed, plus every property whose value transitively references a member of
 *  seed, per the reference graph above. */
function closure(seed, referencedBy) {
  const out = new Set(seed)
  const queue = [...seed]
  while (queue.length) {
    const dependents = referencedBy.get(queue.pop())
    if (!dependents) continue
    for (const d of dependents) if (!out.has(d)) { out.add(d); queue.push(d) }
  }
  return out
}

/* --- reach ------------------------------------------------------------- */

/** Clone a path with extra attributes merged onto its last (subject) node. */
function withAttrs(path, attrs) {
  const last = path[path.length - 1]
  return [...path.slice(0, -1), { ...last, attrs: { ...(last.attrs || {}), ...attrs } }]
}

const sameDeclaration = (a, b) => !!a && !!b && a.file === b.file && a.order === b.order

const AXIS_WHY = {
  tone: (name) => `No slot \`${name}\` sets references \`--tone\`, \`--tone-soft\`, \`--tone-ink\`, ` +
    '\`--tone-line\` or \`--tone-contrast\`, or anything derived from them — the winning declaration ' +
    'would be identical under every data-tone value, so nothing about this component can change colour ' +
    'with the ambient tone.',
  size: (name) => `No slot \`${name}\` sets references \`--scale\` — the winning declaration would be ` +
    'identical under every data-size value, so nothing about this component resizes.',
  theme: (name) => `No slot \`${name}\` sets references a theme token (\`--canvas\`, \`--ink\`, ` +
    '\`--surface\`, \`--line\`, a semantic tone token, or anything derived from one) — swapping ' +
    '\`data-theme\` would leave every declared value unchanged.',
  variant: (name) => `\`${name}\` declares none of \`--bg\`, \`--fg\`, \`--border-color\` or ` +
    '\`--border-width\` — those are the only slots largen.modifiers ever overrides, so data-variant has ' +
    'nothing on this component to outrank.',
}

/**
 * For every reference component, prove whether each of the four axes changes
 * which declaration wins (variant) or is at least referenced by the winning
 * one (tone, size, theme) for at least one of its slots.
 *
 * @param {object} options
 * @param {Array<{name,css}>} options.files
 * @param {string} [options.entry]
 * @param {string[]} options.slots        registered slot names (inherits:false)
 * @param {Array<{name:string}>} options.components
 * @returns {{results: object[], findings: object[], checked: number, undecidable: object[]}}
 */
export function checkAxisReach({ files, entry, slots = [], components = [] }) {
  if (!Array.isArray(files) || !files.length) throw new Error('files must be a non-empty array of { name, css }')
  if (!Array.isArray(components) || !components.length) throw new Error('components must be a non-empty array')

  let ordered = files
  if (entry) ordered = orderFromImports(files, entry).order

  const counter = { n: 0 }
  const rules = ordered.flatMap((f) => parseStylesheet(f.css, f.name, counter))
  const SLOTS = new Set(slots)
  const componentRules = rules.filter((r) => r.layer === 'largen.components')

  const referencedBy = buildReferenceGraph(rules)
  const VOCAB = {
    tone: closure(seedProperties(rules, 'data-tone'), referencedBy),
    size: closure(seedProperties(rules, 'data-size'), referencedBy),
    theme: closure(seedProperties(rules, 'data-theme'), referencedBy),
    /* Not closed over — these ARE the slots largen.modifiers sets, and reach is
       proven at declaration level below, not by textual reference. */
    variant: seedProperties(rules, 'data-variant'),
  }

  const results = []
  const findings = []
  const undecidable = []
  let checked = 0

  for (const comp of components) {
    const name = typeof comp === 'string' ? comp : comp.name
    if (!name) continue

    /* The component's own rule(s): a single compound selector (no combinator)
       naming its class or its custom-element tag. checkComponentsApply in
       cascade.js takes the first comma-branch only; this does too, for the
       same reason — a selector list's later branches are alternate ways in,
       not additional slots. */
    const own = componentRules.filter((r) => {
      const first = splitTopLevel(r.selector)[0]
      const parts = splitCombinators(first)
      if (parts.length !== 1) return false
      const c = parseCompound(parts[0].text)
      return c.classes.includes(name) || c.tag === `l-${name}`
    })

    if (!own.length) {
      undecidable.push({ component: name, reason: 'no rule in largen.components names this component\'s class or custom-element tag' })
      continue
    }

    const reach = { tone: [], variant: [], size: [], theme: [] }
    /* Which slots this component sets in its own rules — the input to the
       participation gate below. */
    const declared = new Set()

    for (const rule of own) {
      const selector = splitTopLevel(rule.selector)[0]
      const path = synthesizePath(selector)
      if (!path) {
        /* The four-answer rule (genai/cascade.js): a selector this cannot
           represent as a chain is UNDECIDABLE, not silently skipped and not
           counted as a failure to respond. */
        undecidable.push({ component: name, file: rule.file, line: rule.line, selector: rule.selector, reason: 'selector cannot be synthesised into an ancestor chain' })
        continue
      }

      for (const decl of rule.declarations) {
        if (!SLOTS.has(decl.property)) continue
        declared.add(decl.property)
        checked++

        let winner
        try { winner = resolveProperty({ files: ordered, path, property: decl.property }).winner }
        catch { continue }
        /* Cannot happen for a rule resolving its own selector — see the
           identical guard and comment in checkComponentsApply. */
        if (!winner) continue

        for (const axis of ['tone', 'size', 'theme']) {
          const refs = [...winner.value.matchAll(VAR_REF)].map((m) => m[1])
          const via = refs.find((r) => VOCAB[axis].has(r))
          if (via) {
            reach[axis].push({
              slot: decl.property, method: 'value', via,
              file: winner.file, line: winner.line, value: winner.value,
            })
          }
        }

        if (VOCAB.variant.has(decl.property)) {
          const probePath = withAttrs(path, { 'data-variant': AXES.variant[0] })
          let probeWinner
          try { probeWinner = resolveProperty({ files: ordered, path: probePath, property: decl.property }).winner }
          catch { probeWinner = null }
          if (probeWinner && !sameDeclaration(winner, probeWinner)) {
            reach.variant.push({
              slot: decl.property, method: 'declaration',
              file: probeWinner.file, line: probeWinner.line, value: probeWinner.value,
            })
          }
        }
      }
    }

    /* Does this component take part in the axis at all?
     *
     * Without this gate the check reported seventy-one errors against a correct
     * library, most of them against layout utilities. `.stack` sets `--gap` and
     * nothing else; it has no colour for a tone to change and nothing for a
     * variant to outrank. Reporting that as a defect asks the author to paint
     * something largen deliberately leaves alone — which is failure mode F6 — and
     * produces a finding no correct repair can clear. That is the shape this
     * project spent a release removing from `verify`.
     *
     * The two gates are not symmetric, and the asymmetry is a real property of
     * the algebra rather than a convenience:
     *
     *   tone / variant / theme  FREE. Set any colour-bearing slot and all seven
     *                           tones, four variants and both themes follow. A
     *                           component setting none has opted out by having no
     *                           colour, which is legitimate.
     *   size                    OPT-IN. `--scale` inherits, but a component only
     *                           resizes if it multiplies by it —
     *                           `calc(0.78rem * var(--scale))`. So the axis is
     *                           only owed to a component that sets `--font-size`;
     *                           a 1px divider not scaling is a choice, not a bug.
     *
     * Non-participation is reported as data, never as a finding. */
    const COLOUR_SLOTS = ['--bg', '--fg', '--border-color', '--border-width']
    const participates = {
      /* Only variant is OWED. The others are reported and not enforced, and the
         difference is which claim is structural.
       *
       * Setting `--bg` obliges largen.modifiers to be able to outrank it — that is
         a fact about layer order, it holds for every value, and getting it wrong is
         the silent failure this library documents first. So variant is a gate.
       *
       * Tone is a choice. `card`, `panel`, `prose` and `divider` set `--bg:
         var(--surface)` on purpose: they are neutral, and a neutral component is
         not a broken one. An earlier version of this gate reported all twelve as
         defects, which would have asked their authors to tint things the library
         deliberately leaves alone. The genuine tone defect — a colour written as a
         literal — is already caught by genai/lint.js's colour-literal rule, and
         duplicating it here would give two answers that could disagree.
       *
       * Size is opt-in by construction: `--scale` inherits, but nothing resizes
         unless the component multiplies by it. Theme follows tone. Both are
         census, and the rendered sample below is what proves the mechanism works. */
      variant: COLOUR_SLOTS.some((slot) => declared.has(slot)),
      tone: false,
      theme: false,
      size: false,
    }
    const uses = {
      variant: participates.variant,
      tone: COLOUR_SLOTS.some((slot) => declared.has(slot)),
      theme: COLOUR_SLOTS.some((slot) => declared.has(slot)),
      size: declared.has('--font-size'),
    }

    for (const axis of ['tone', 'variant', 'size', 'theme']) {
      const hits = reach[axis]
      results.push({
        component: name, axis, reached: hits.length > 0,
        /* `owed` gates a finding; `uses` records that the component has something
           the axis could act on, which is the census the runner reports. */
        participates: participates[axis], uses: uses[axis],
        method: hits[0]?.method ?? null, evidence: hits[0] ?? null, hits: hits.length,
      })
      if (!hits.length && participates[axis]) {
        findings.push({
          component: name, axis, rule: 'axis-not-reached', severity: 'error',
          message: `\`${name}\` does not respond to the ${axis} axis`,
          why: AXIS_WHY[axis](name),
        })
      }
    }
  }

  return { results, findings, checked, undecidable }
}
