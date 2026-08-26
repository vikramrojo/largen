/* The composition rules, and the reason they exist.
 *
 * Wave 1 of this change shipped five composition topics. A bake-off then ran the
 * shipped contract with no addendum, and exactly one topic changed the output:
 * the only one with a lint rule behind it. The gradient topic had prose AND a
 * working, copy-pasteable snippet and produced zero gradients.
 *
 * So the rules here are not belt-and-braces on top of documentation. They are
 * the part that made the documentation land, and each one is tested for BOTH
 * halves — that it fires on the defect and that it clears on the correct code.
 * A rule a correct choice cannot clear is a loop that cannot exit, which is why
 * these are warnings and why the clearing cases outnumber the firing ones.
 */
import { readFileSync, existsSync } from 'node:fs'
import { lintComponentCss, registeredSlots, lintPageHtml } from '../../genai/lint.js'

const root = new URL('../../', import.meta.url).pathname
const slots = registeredSlots(readFileSync(root + 'src/properties.css', 'utf8'))

let pass = 0, fail = 0
const check = (name, fn) => {
  try { const d = fn(); pass++; console.log(`  ok    ${name}${d ? ` — ${d}` : ''}`) }
  catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`) }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg) }

const count = (css, rule) =>
  lintComponentCss(css, { slots }).findings.filter((f) => f.rule === rule).length
const layered = (body) => `@layer largen.components{${body}}`

console.log('\n  composition rules\n')

/* --- slot-gradient ------------------------------------------------------- */

check('`slot-gradient` fires on every gradient function through --bg', () => {
  const fns = [
    'linear-gradient(160deg, var(--shade), transparent)',
    'radial-gradient(60rem 40rem at 20% 0%, var(--shade), transparent 70%)',
    'conic-gradient(var(--shade), transparent)',
    'repeating-linear-gradient(45deg, var(--shade), transparent 2rem)',
  ]
  for (const fn of fns) {
    assert(count(layered(`.hero{--bg:${fn}}`), 'slot-gradient') === 1, `did not fire on ${fn.split('(')[0]}`)
  }
  return `${fns.length} gradient functions`
})

check('`slot-gradient` fires on --fg too', () => {
  assert(count(layered('.h{--fg:linear-gradient(var(--ink),transparent)}'), 'slot-gradient') === 1,
    '--fg drives color, which is also a <color> and also cannot take an image')
  return '--fg drives `color`, same failure'
})

check('`slot-gradient` clears on the documented pattern', () => {
  /* This is the exact shape the contract now teaches: the slot keeps the element
     inside the algebra, the plain property adds what has no slot. If this warned,
     the rule would be telling authors not to do the thing it recommends. */
  const css = layered('.hero{--bg:var(--canvas);background-image:radial-gradient(60rem 40rem at 20% 0%,var(--shade),transparent 70%)}')
  assert(count(css, 'slot-gradient') === 0, 'warned on the pattern the contract recommends')
  return 'slot on a token + background-image beside it'
})

check('`slot-gradient` is silent on slots that legitimately take images', () => {
  assert(count(layered('.c{--shadow:var(--lift-2)}'), 'slot-gradient') === 0, 'warned on --shadow')
  assert(count(layered('.c{--transition:var(--speed)}'), 'slot-gradient') === 0, 'warned on --transition')
  assert(count(layered('.c{--bg:var(--tone-soft)}'), 'slot-gradient') === 0, 'warned on a plain token')
  return 'only the two <color> slots are checked'
})

check('`slot-gradient` is a warning, not an error', () => {
  const f = lintComponentCss(layered('.h{--bg:linear-gradient(var(--shade),transparent)}'), { slots })
    .findings.find((x) => x.rule === 'slot-gradient')
  assert(f, 'no finding at all')
  assert(f.severity === 'warning', `severity is ${f.severity}`)
  /* The `why` has to carry the fix, because the agent that reads it is the one
     that has to act on it and it will not go and read the contract first. */
  assert(/background-image/.test(f.why), 'the why does not name the fix')
  return 'warning, and the why carries the fix'
})

/* --- the rule exists because the failure mode did not have one ------------ */

check('every documented failure mode about a slot value has a check', () => {
  /* Not exhaustive across the taxonomy — this pins the specific gap that this
     wave closed, so a future edit that removes the rule but leaves the prose is
     caught. */
  assert(count(layered('.h{--bg:linear-gradient(var(--shade),transparent)}'), 'slot-gradient') === 1,
    'the vanishing gradient is documented as a failure mode and no longer has a check')
  return 'the vanishing gradient is checkable'
})

/* --- layout-by-hand ------------------------------------------------------ */

check('`layout-by-hand` names the utility that matches', () => {
  const named = (body) => {
    const f = lintComponentCss(layered(body), { slots }).findings.find((x) => x.rule === 'layout-by-hand')
    return f ? f.message.match(/`\.(\w+)`/)[1] : null
  }
  assert(named('.a{display:flex;align-items:center;gap:1rem}') === 'row', 'flex + align is `.row`')
  assert(named('.a{display:flex;flex-wrap:wrap;align-items:center;gap:1rem}') === 'cluster', 'wrapping is `.cluster`')
  assert(named('.a{display:flex;flex-direction:column;gap:1rem}') === 'stack', 'column is `.stack`')
  return 'row / cluster / stack'
})

check('`layout-by-hand` is silent when no utility matches', () => {
  /* Bare `display:flex` with hand-managed children is nobody's `.row`, and
     naming one would be the kind of confidently wrong suggestion that teaches an
     author to stop reading hints. */
  assert(count(layered('.a{display:flex}'), 'layout-by-hand') === 0, 'fired on bare flex')
  assert(count(layered('.a{display:grid;gap:1rem}'), 'layout-by-hand') === 0, 'fired on grid')
  return 'bare flex and grid pass'
})

check('`layout-by-hand` is a hint, and largen\'s own components are clean', () => {
  const f = lintComponentCss(layered('.a{display:flex;align-items:center;gap:1rem}'), { slots })
    .findings.find((x) => x.rule === 'layout-by-hand')
  assert(f.severity === 'info', `severity is ${f.severity}`)
  const own = readFileSync(root + 'components/index.css', 'utf8')
  assert(count(own, 'layout-by-hand') === 0, "largen's own components hand-write layout")
  return 'info, 0 on components/index.css'
})

/* --- section-rhythm ------------------------------------------------------- */

check('`section-rhythm` fires only past three sections, and any lever clears it', () => {
  const three = '<section>a</section><section>b</section><section>c</section>'
  const fires = (html, css) => lintPageHtml(html, { css }).findings.length > 0
  assert(fires(`<body>${three}</body>`), 'did not fire on three bare sections')
  assert(!fires('<body><section>a</section><section>b</section></body>'), 'fired on two sections')
  assert(!fires(`<body class="stack">${three}</body>`), 'a stack on body did not clear it')
  assert(!fires(`<body style="--gap: 2rem">${three}</body>`), 'an inline --gap did not clear it')
  assert(!fires(`<body>${three}</body>`, 'body{--gap:var(--space-24)}'), '--gap in CSS did not clear it')
  return 'three levers, all accepted'
})

check('`section-rhythm` separates the bake-off run that lacked rhythm', () => {
  /* The rule was tested against these before it was written. Run 1 is the page
     whose sections butted together; runs 2 and 3 are the ones that did not. If a
     future edit makes this rule fire on all three or none, it has stopped
     measuring the thing it was built from. */
  const runs = root + '.claude/skills/largen-bakeoff/runs/'
  const verdict = (r) => {
    const html = `${runs}${r}/largen/index.html`, css = `${runs}${r}/largen/components.css`
    if (!existsSync(html)) return null
    return lintPageHtml(readFileSync(html, 'utf8'), { css: readFileSync(css, 'utf8') }).findings.length > 0
  }
  const plain = verdict('20260824-0818')
  const good = ['20260824-0933-addendum', '20260824-1112'].map(verdict)
  if (plain === null) return 'skipped — the runs are not on disk'
  assert(plain === true, 'run 1 visibly lacked section rhythm and the rule cleared it')
  for (const [i, v] of good.entries()) {
    if (v === null) continue
    assert(v === false, `run ${i + 2} had rhythm and the rule fired on it`)
  }
  return 'fires on run 1, clears on runs 2 and 3'
})

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
