/* The three lint checks added for the ds-check evaluation, and the cases that
 * motivated each one.
 *
 * Two of them exist because the linter was value-based and therefore blind. The
 * contract had forbidden dark-mode rules and hand-written size variants since
 * `component-authoring` was written, but the only thing that ever caught a dark
 * block was a colour literal sitting inside it — so a component written entirely
 * with tokens passed clean, twice over. Both evasion cases below are copied from
 * the findings document verbatim, and each is asserted to produce an error with
 * zero colour literals present, because "it fires" and "it fires for the right
 * reason" are different claims.
 *
 * The third is new, and new rules are where false positives get shipped. Its
 * negative cases outnumber its positive ones on purpose: `entry-link`,
 * `facet-label`, `field-row`, `l-menu` and `note-title` are real selectors in
 * this repository, every one of them a container and none of them a mistake. A
 * rule that fires on those is worse than no rule, so they are pinned here.
 *
 * The severity of the coined-tag rule is staged — warning now, error in the next
 * minor — and the last assertion proves that promotion is one constant and
 * nothing else, by patching the constant in a copy of the module and watching
 * the severity move. It does not edit the shipped file.
 *
 *   node site/test/lint-checks.mjs
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  COINED_TAG_SEVERITY, nativeElementFor,
  lintComponentCss, registeredSlots, classifySheet,
} from '../../genai/lint.js'
import { discover } from '../../skill/scripts/paths.mjs'

const root = new URL('../../', import.meta.url).pathname
const slots = registeredSlots(readFileSync(root + 'src/properties.css', 'utf8'))

let pass = 0, fail = 0
const check = (name, fn) => {
  try { const d = fn(); pass++; console.log(`  ok    ${name}${d ? ` — ${d}` : ''}`) }
  catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`) }
}
const assert = (c, m) => { if (!c) throw new Error(m) }
const eq = (a, b, m) => assert(a === b, `${m}\n          expected ${JSON.stringify(b)}\n          got      ${JSON.stringify(a)}`)

const NEW_RULES = ['dark-rule', 'size-variant', 'coined-tag']
const lint = (css) => lintComponentCss(css, { slots })
/** Only the findings these three checks produce — the older rules have their own tests. */
const news = (css) => lint(css).findings.filter((f) => NEW_RULES.includes(f.rule))

/** Assert a snippet produces exactly one new finding, and return it. */
function one(css, rule) {
  const found = news(css)
  eq(found.length, 1, `expected exactly one finding, got ${JSON.stringify(found.map((f) => f.message))}`)
  eq(found[0].rule, rule, 'the wrong rule fired')
  assert(found[0].why && found[0].why.length > 80, 'the finding carries no explanation')
  return found[0]
}
const silent = (css, why) => {
  const found = news(css)
  eq(found.length, 0, `${why}\n          fired: ${JSON.stringify(found.map((f) => `${f.rule}: ${f.message}`))}`)
}

const layered = (body) => `@layer largen.components {\n${body}\n}`

console.log('\n  lint — coined tags, dark rules, size variants\n')

/* --- The dark-mode rule (1.2a, error) ------------------------------------ */

check('a token-valued dark block errors, with no colour literal in it', () => {
  /* The evasion case from the findings, verbatim. It passed clean before this
     rule existed because every check that could have caught it read values. */
  const css = '@media (prefers-color-scheme: dark) { .plan-capacity { --bg: var(--surface); } }'
  assert(!/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/i.test(css), 'the fixture contains a colour literal')
  const f = one(css, 'dark-rule')
  eq(f.severity, 'error', 'a SHALL NOT the contract already carried is an error, not a warning')
  eq(f.message, 'a component must not carry its own dark-mode rule: `@media (prefers-color-scheme: dark)`',
    'the finding text moved')
  assert(!lint(css).ok, 'an error must make the result not ok')
  return f.message
})

check('a dark block written AFTER the components layer closes is still caught', () => {
  /* The commonest spelling, and the one a region-scoped check misses: the layer
     block ends at its closing brace and the media query sits past it. */
  const f = one(
    '@layer largen.components { .card { --bg: var(--surface); } }\n' +
    '@media (prefers-color-scheme: dark) { .card { --bg: var(--canvas); } }', 'dark-rule')
  eq(f.severity, 'error', 'wrong severity')
  return 'the whole sheet is read, not just the layer block'
})

check('a component scoped to a theme selector errors', () =>
  one(layered('  [data-theme="dark"] .card { --bg: var(--surface); }'), 'dark-rule').message)

check('a theme file setting tokens under [data-theme] stays silent', () => {
  /* Not a component, so the component rules never reach it. This is the false
     positive that would otherwise have forced warning-first staging, and it is
     classifySheet that removes it rather than anything in the rule. */
  const css = '@layer largen.tokens {\n  [data-theme="dark"] {\n    --canvas: #101214;\n    --ink: #f2f4f6;\n  }\n}'
  eq(classifySheet(css, slots).kind, 'not-component', 'a theme file classified as a component')
  silent(css, 'a theme is not a component and must not be judged by component rules')
  return 'classifySheet keeps themes out of scope'
})

check('an unlayered theme stays silent too', () => {
  const css = '[data-theme="dark"] {\n  --canvas: #101214;\n  --ink: #f2f4f6;\n}'
  silent(css, 'an unlayered theme sets tokens, not slots, so it is still not a component')
  return 'tokens are not slots'
})

check('a non-colour media query is not a dark rule', () => {
  silent(layered('  @media (prefers-reduced-motion: reduce) { .spinner { --transition: none; } }'),
    'only prefers-color-scheme is a dark rule')
  return 'prefers-reduced-motion is fine'
})

/* --- The size variant (1.2b, error) -------------------------------------- */

check('a token-valued size variant errors and names the slots it re-sets', () => {
  const css = '.plan-capacity--lg { --pad: var(--pad-5); --font-size: var(--text-lg); }'
  const f = one(css, 'size-variant')
  eq(f.severity, 'error', 'wrong severity')
  eq(f.message, '`.plan-capacity--lg` is a hand-written size variant — it re-sets `--pad`, `--font-size`',
    'the finding text moved')
  assert(!lint(css).ok, 'an error must make the result not ok')
  return f.message
})

check('a data-size scoped rule re-setting a scale slot errors', () => {
  const f = one(layered('  .card[data-size="lg"] { --pad: 1.5em; }'), 'size-variant')
  eq(f.message, '`.card[data-size="lg"]` is a hand-written size variant — it re-sets `--pad`',
    'the finding text moved')
  return f.message
})

check('a modifier that is not a size value stays silent', () => {
  /* The deliberate scoping: both halves are required, so a legitimately named
     modifier setting non-scale slots is not caught. */
  silent(layered('  .plan-capacity--empty { --bg: var(--surface); --fg: var(--ink-muted); }'),
    '--empty is not a size-axis value')
  return '.plan-capacity--empty'
})

check('a size-suffixed modifier that sets no scale slot stays silent', () => {
  silent(layered('  .badge--sm { --bg: var(--tone-soft); --radius: var(--radius-sm); }'),
    'the rule re-sets no slot the size axis already drives')
  return 'both halves are required'
})

check('a size value inside a longer word is not a size suffix', () => {
  silent(layered('  .card--smart { --pad: 1em; }\n  .card--md5 { --gap: 1em; }'),
    '`--smart` and `--md5` are not `--sm` and `--md`')
  return '--smart, --md5'
})

/* --- The coined tag (1.1, staged severity) -------------------------------- */

check('a coined tag that impersonates a native element errors and names it', () => {
  const css = layered('  button-primary, .button-primary { --bg: var(--tone); }')
  const f = one(css, 'coined-tag')
  eq(f.message, '`<button-primary>` coins a tag where the native `<button>` exists',
    'the finding text moved')
  eq(f.severity, COINED_TAG_SEVERITY, 'the severity did not come from the constant')
  assert(!lint(css).ok, 'the rule is promoted, so the result must no longer be ok')
  return f.message
})

check('every leading token in the list fires and names its own element', () => {
  const names = ['button', 'nav', 'dialog', 'input', 'select', 'form', 'menu', 'a', 'label']
  for (const n of names) {
    const f = one(layered(`  ${n}-thing { --bg: var(--tone); }`), 'coined-tag')
    eq(f.message, `\`<${n}-thing>\` coins a tag where the native \`<${n}>\` exists`,
      `${n}-thing named the wrong element`)
  }
  return `${names.length} leading tokens`
})

check('a coined tag with no role implied stays silent', () => {
  /* The README's first example, and largen's own documentation style. */
  silent(layered('  .notification, notification { --bg: var(--tone-soft); }'),
    '`notification` implies no role and is exactly what a coined tag is for')
  return 'notification'
})

check("this repository's own coined tags stay silent", () => {
  /* Real selectors from components/reference.css and sites/example/components.css.
     A rule that fires on these is worse than no rule: matching the LEADING token
     rather than any token is the whole reason they are quiet. */
  const real = ['entry-link', 'facet-label', 'field-row', 'l-menu', 'l-field-label',
    'note-title', 'catalog-header', 'timeline-entry', 'l-table-wrap']
  for (const n of real) {
    silent(layered(`  .${n}, ${n} { --bg: var(--tone-soft); }`), `${n} is a container, not a control`)
  }
  return real.join(', ')
})

check('a class is not a coined tag', () => {
  silent(layered('  .button-primary { --bg: var(--tone); }'),
    'a class on an element says nothing about the element')
  return '.button-primary alone'
})

check('a property name inside a block is never read as a tag', () => {
  /* The check reads selectors only. Scanning raw text would fire on
     `align-items`, `font-size` and `border-radius` in almost every component. */
  silent(layered('  .card { align-items: center; font-size: 1em; border-radius: 4px; --bg: var(--tone-soft); }'),
    'declarations are not selectors')
  return 'selectors only'
})

check('a coined tag is reported once, however many rules mention it', () => {
  const found = news(layered(
    '  button-primary { --bg: var(--tone); }\n' +
    '  button-primary:hover { --bg: var(--tone-soft); }\n' +
    '  button-primary[data-variant="outline"] { --bg: transparent; }'))
  eq(found.length, 1, `the same advice was given ${found.length} times`)
  return 'once per name'
})

check('`nativeElementFor` answers the same question for a manifest `element`', () => {
  /* Exported so the manifest side asks the list rather than copying it. */
  eq(nativeElementFor('button-primary'), 'button', 'missed a coined tag')
  eq(nativeElementFor('nav-rail'), 'nav', 'missed a coined tag')
  eq(nativeElementFor('a-card'), 'a', 'a single-letter leading token is still a leading token')
  eq(nativeElementFor('notification'), null, 'a name with no hyphen is not a coined tag')
  eq(nativeElementFor('button'), null, '`button` IS the native button')
  eq(nativeElementFor('entry-link'), null, 'matched a trailing token')
  eq(nativeElementFor(''), null, 'empty name')
  eq(nativeElementFor(undefined), null, 'missing name')
  eq(nativeElementFor('BUTTON-PRIMARY'), 'button', 'case should not matter')
  return '9 cases'
})

/* Task 5.1 promotes this warning to an error. Proving that is a one-line change
   means patching the constant in a COPY of the module and importing that — the
   shipped file is never touched, and if the severity were written at the call
   site instead of read from the constant, the assertions below would fail.
   `genai/lint.js` imports nothing, so a copy of it runs standalone. */
const SRC = readFileSync(root + 'genai/lint.js', 'utf8')
/* The promotion has happened: the constant reads `error` now. The patch runs
   backwards, to `warning`, which proves the same thing it proved before it
   shipped — the severity is read from one place and nothing writes it at a call
   site. Reverting is also the rollback, so this keeps that path exercised. */
const PATCHED = SRC.replace(
  "export const COINED_TAG_SEVERITY = 'error'",
  "export const COINED_TAG_SEVERITY = 'warning'")
const dir = mkdtempSync(join(tmpdir(), 'largen-lint-severity-'))
writeFileSync(join(dir, 'lint.js'), PATCHED)
const flipped = await import(join(dir, 'lint.js'))
rmSync(dir, { recursive: true, force: true })

check('the severity is one constant, and moving it is the whole promotion', () => {
  assert(PATCHED !== SRC, 'the constant is not spelled as expected in genai/lint.js')
  /* 'error' → 'warning' is exactly two characters longer. If the patch moved
     anything else, the constant is not the only place the severity is written. */
  eq(PATCHED.length, SRC.length + 2, 'patching the constant changed more than the one word')
  eq(flipped.COINED_TAG_SEVERITY, 'warning', 'the constant did not move')

  const css = layered('  button-primary { --bg: var(--tone); }')
  const shipped = lint(css)
  const staged = flipped.lintComponentCss(css, { slots })
  const f = staged.findings.filter((x) => x.rule === 'coined-tag')
  eq(f.length, 1, 'the rule stopped firing when the constant moved')
  eq(f[0].severity, 'warning', 'the finding severity did not follow the constant')
  eq(f[0].message, shipped.findings.find((x) => x.rule === 'coined-tag').message,
    'the message must not change with the severity — only the severity does')
  assert(!shipped.ok, 'at error severity the result must not be ok')
  assert(staged.ok, 'at warning severity the result is ok again')
  return 'error → warning, one constant, same text'
})

/* --- The regression that matters most ------------------------------------ */

check('the three new checks are silent on every component file in this repo', () => {
  /* Three new rules, two of them errors, shipped against a repository whose own
     stylesheets have to stay clean. Anything here is a false positive by
     definition — these files were conformant before the rules existed. */
  let files = 0
  for (const file of discover(root)) {
    const css = readFileSync(file, 'utf8')
    if (classifySheet(css, slots).kind !== 'component') continue
    files++
    const found = news(css)
    assert(found.length === 0,
      `${file.replace(root, '')} — ${found.map((f) => `${f.rule}: ${f.message}`).join('; ')}`)
  }
  assert(files >= 5, `expected to find the component files, saw ${files}`)
  return `${files} component files, no new findings`
})

/* --- The compact contract's size budget ----------------------------------
 *
 * Not a lint rule, but it lives here because it is the same kind of claim: a
 * thing that has to stay true and that nothing else checks. `largen contract`
 * warns when llms-compact.txt outgrows its budget, and a warning on a command
 * nobody runs in CI is a warning nobody sees — this change went over the limit
 * and only the generator's own output said so.
 *
 * Measured the way the generator measures it, deliberately: `compact.length`,
 * which is CHARACTERS. A test that used bytes would disagree with the tool it is
 * guarding by about 370, because the file is full of em dashes and arrows. */
const COMPACT_LIMIT = 24 * 1024
const compact = readFileSync(root + 'site/public/llms-compact.txt', 'utf8')
const skillMd = readFileSync(root + 'skill/SKILL.md', 'utf8')
const flat = (s) => s.replace(/\s+/g, ' ')
const { RULES } = await import('../mcp/contract.mjs')

check('llms-compact.txt is inside the budget the generator enforces', () => {
  const bytes = Buffer.byteLength(compact, 'utf8')
  assert(compact.length <= COMPACT_LIMIT,
    `${compact.length} characters, over the ${COMPACT_LIMIT} budget by ` +
    `${compact.length - COMPACT_LIMIT}. Trim the contract or split it — do not raise ` +
    'the limit. `node skill/scripts/cli.mjs contract` prints the same number.')
  return `${compact.length} chars, ${COMPACT_LIMIT - compact.length} to spare (${bytes} bytes on disk)`
})

check('a rule is in the compact file unless it opts out, and the two that do are named', () => {
  const inline = RULES.filter((r) => r.compact !== false)
  const elsewhere = RULES.filter((r) => r.compact === false)
  assert(inline.length > 0 && elsewhere.length === 2, `expected two opt-outs, got ${elsewhere.length}`)

  /* The default is inclusive so a rule added later cannot be dropped by
     forgetting a flag. That property is the whole reason the flag is opt-out. */
  for (const r of inline) {
    assert(flat(compact).includes(flat(r.title)), `${r.id} is missing from llms-compact.txt`)
  }
  for (const r of elsewhere) {
    const lede = r.title.split('. ')[0]
    assert(!flat(compact).includes(flat(r.why.slice(0, 60))),
      `${r.id}'s body is still in llms-compact.txt`)
    assert(flat(compact).includes(`"${lede}"`),
      `${r.id} was removed without the pointer naming it`)
  }
  return `${inline.length} inline, ${elsewhere.length} pointed at`
})

check('nothing was deleted — every rule is still in SKILL.md in full', () => {
  for (const r of RULES) {
    assert(flat(skillMd).includes(flat(r.title)), `${r.id}'s title is missing from SKILL.md`)
    assert(flat(skillMd).includes(flat(r.why.slice(0, 60))), `${r.id}'s body is missing from SKILL.md`)
  }
  return `${RULES.length} rules, titles and bodies`
})

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
