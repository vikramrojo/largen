/* `largen verify` across files, on a project that is not largen.
 *
 * The gap this closes: every check the linter made read one file, and the
 * failures that cost the most are cross-file. A component sets `--weight: 500`
 * inside `largen.components`, another file's sublayer sorts after it, and the
 * declaration is correct, the file is correct, and the element paints 300.
 * `largen verify` said ok.
 *
 * For a person that is a footnote. For an agent looping generate → validate →
 * repair it is the whole thing: the loop terminates when validate says clean, so
 * a verifier that returns clean on a broken component ends the loop holding
 * something wrong and believing it is right.
 *
 * These fixtures are a scratch project, run through the CLI the way a consumer
 * would, because the bug only exists between files.
 */
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const run = promisify(execFile)
const CLI = new URL('../../skill/scripts/cli.mjs', import.meta.url).pathname
const DIST = new URL('../../dist/largen.css', import.meta.url).pathname

let pass = 0, fail = 0
const check = async (name, fn) => {
  try { const d = await fn(); pass++; console.log(`  ok    ${name}${d ? ` — ${d}` : ''}`) }
  catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`) }
}
const assert = (c, m) => { if (!c) throw new Error(m) }

/** Build a scratch project and run `largen verify` inside it. */
async function verify(files, args = []) {
  const dir = mkdtempSync(join(tmpdir(), 'largen-verify-'))
  try {
    mkdirSync(join(dir, 'styles'), { recursive: true })
    copyFileSync(DIST, join(dir, 'styles/largen.css'))
    for (const [name, css] of Object.entries(files)) writeFileSync(join(dir, 'styles', name), css)
    try {
      const { stdout } = await run('node', [CLI, 'verify', ...args], { cwd: dir, timeout: 60_000 })
      return { code: 0, out: stdout }
    } catch (e) {
      return { code: e.code ?? 1, out: (e.stdout ?? '') + (e.stderr ?? '') }
    }
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

const COMPONENTS = `@layer largen.components {
  .kbd { --weight: 500; --pad: .1em .35em }
}`

/* The reported shape: a framework sublayer declared after largen, so it sorts
   after it, so the component loses. Every file is individually correct. */
const BROKEN_ENTRY = `@import url("largen.css");
@import url("components.css");
@import url("site.css");`
const SITE_SUBLAYER = `@layer site.base, site.overrides;
@layer site.base { * { --weight: 300 } }`

/* The repair verify's own guidance describes: one statement, before anything
   creates a layer, with flat names so the two halves are independent. */
const FIXED_ENTRY = `@layer site-base, largen.reset, largen.tokens, largen.paint, largen.tone,
  largen.elements, largen.components, largen.modifiers, site-overrides;

@import url("largen.css");
@import url("components.css");
@import url("site.css");`
const SITE_FLAT = `@layer site-base { * { --weight: 300 } }`

await check('a component that never applies fails verification', async () => {
  const r = await verify({ 'main.css': BROKEN_ENTRY, 'components.css': COMPONENTS, 'site.css': SITE_SUBLAYER })
  assert(r.code !== 0, 'verify passed a component whose declaration never applies')
  assert(/never applies/.test(r.out), 'no finding about the declaration not applying')
  assert(/--weight: 500/.test(r.out), 'did not name the declaration')
  assert(/site\.base/.test(r.out), 'did not name what wins')
  return 'reported, with the winner named'
})

await check('the finding says which cascade step decided it', async () => {
  const r = await verify({ 'main.css': BROKEN_ENTRY, 'components.css': COMPONENTS, 'site.css': SITE_SUBLAYER })
  assert(/layer order/i.test(r.out), 'no cascade reason given')
  assert(/sublayer/i.test(r.out), 'did not explain the sublayer rule, which is what makes it invisible')
  assert(/Winning declaration: .*site\.css:\d+/.test(r.out), 'did not point at the winning line')
  return 'layer order, sublayer parenting, and the line to look at'
})

await check('applying that guidance makes it pass', async () => {
  /* The other half of the loop. A verifier that only ever fails is not a loop. */
  const r = await verify({ 'main.css': FIXED_ENTRY, 'components.css': COMPONENTS, 'site.css': SITE_FLAT })
  assert(r.code === 0, `still failing after the documented repair:\n${r.out}`)
  assert(/every slot a component sets is the one that wins/.test(r.out), 'the check did not run')
  return 'generate → validate → repair converges'
})

await check('a correct project is not faulted for layering in its own layer', async () => {
  /* This was a false positive: a framework default set inside `@layer site-base`
     came back as a component that had forgotten its layer. An agent cannot
     converge against a finding that repair does not clear. */
  const r = await verify({ 'main.css': FIXED_ENTRY, 'components.css': COMPONENTS, 'site.css': SITE_FLAT })
  assert(!/not declared inside/.test(r.out),
    `a layered framework file was reported as an unlayered component:\n${r.out}`)
  return 'no finding a repair cannot clear'
})

await check('a component with no layer at all is still caught', async () => {
  const r = await verify({
    'main.css': FIXED_ENTRY, 'components.css': COMPONENTS, 'site.css': SITE_FLAT,
    'oops.css': '.notification { --bg: var(--tone-soft); --pad: 1em }',
  })
  assert(r.code !== 0, 'an unlayered component passed')
  assert(/not declared inside `@layer largen.components`/.test(r.out), 'wrong finding')
  return 'the local check still does its job'
})

await check('without a load order the cascade checks are declined, not guessed', async () => {
  /* Two entry points, so the order is genuinely ambiguous. Answering anyway would
     describe a cascade the project does not have. */
  const r = await verify({
    'a.css': '@import url("components.css");',
    'b.css': '@import url("components.css");',
    'components.css': COMPONENTS,
  })
  assert(/NOT RUN/.test(r.out), 'ran the cascade checks on an order it could not know')
  assert(/--entry/.test(r.out), 'did not say how to supply the order')
  return 'declined, and says how to enable it'
})

await check('the summary states what was checked, not one word for both', async () => {
  const withOrder = await verify({ 'main.css': FIXED_ENTRY, 'components.css': COMPONENTS, 'site.css': SITE_FLAT })
  assert(/the cascade across files/.test(withOrder.out), 'did not say the cascade was checked')
  assert(/Not rendering/.test(withOrder.out), 'did not say rendering was not')
  assert(!/all static checks passed/.test(withOrder.out),
    'still claims "static only" after resolving the cascade')
  return 'the contract, and the cascade; not rendering'
})

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
