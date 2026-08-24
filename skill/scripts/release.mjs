/* Freeze the current dist/ at an immutable versioned path.
 *
 * The site serves /largen.css straight out of dist/, so it always reflects the
 * current build with no copy step. That is right for the unversioned path and
 * wrong for a versioned one: /v/0.1.0/largen.css must return the same bytes
 * forever, and reading it from dist/ would silently change it at the next build.
 *
 * So versioned paths are snapshots, and this refuses to overwrite one. If a
 * version needs different bytes, it needs a different version.
 */
import { readdirSync, mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { at } from './paths.mjs'

export async function release(args = []) {
  const force = args.includes('--force')
  const pkg = JSON.parse(readFileSync(at('package.json'), 'utf8'))
  const dir = at('site/public/v', pkg.version)

  if (!existsSync(at('dist'))) throw new Error('no dist/ — run `largen build` first')

  /* Freezing a version whose generated surfaces are stale freezes the wrong
     bytes, and SKILL.md and README.md are both shipped, so regenerating them
     afterwards changes the package under a version that is already frozen. */
  const { contract } = await import('./contract.mjs')
  await contract(['--check'])

  /* Record the fingerprint of the code this version ships, LAST — after every
     generator has run, because several of them write files that ship. Getting
     this order wrong is not subtle: `largen contract` rewrites SKILL.md, and a
     digest taken before it is stale the moment it is recorded.
     
     This is the check that would have caught 0.3.2, whose stylesheets never moved
     and whose verify command was rewritten underneath it. */
  const { packageDigest } = await import('./releases.mjs')
  const logPath = at('genai/releases.json')
  const log = JSON.parse(readFileSync(logPath, 'utf8'))
  const entry = log.releases.find((r) => r.version === pkg.version)
  if (!entry) {
    throw new Error(
      `genai/releases.json has no entry for ${pkg.version}.\n` +
      '  A published version with nothing written down is the failure the release\n' +
      '  log exists to prevent. Add the entry, then freeze.')
  }
  entry.package = packageDigest()
  writeFileSync(logPath, JSON.stringify(log, null, 1) + '\n')
  console.log(`\n  recorded the shipped-code digest for ${pkg.version}: ${entry.package.slice(0, 12)}…`)

  if (existsSync(dir) && !force) {
    throw new Error(
      `site/public/v/${pkg.version}/ already exists.\n` +
      '  A published versioned path must always return the same bytes, so this\n' +
      '  will not overwrite it. Bump the version in package.json, or pass --force\n' +
      '  if nothing has consumed this path yet.')
  }

  mkdirSync(dir, { recursive: true })
  /* build.json travels with the snapshot, so a frozen path can state its own
     hashes. The already-published 0.1.0 and 0.2.0 do not get one retrofitted:
     adding a file to a frozen directory is the thing this guard exists to
     prevent, and a version that gained a file would not be the same release. */
  const files = readdirSync(at('dist')).filter((f) => f.endsWith('.css') || f === 'build.json')
  for (const f of files) copyFileSync(at('dist', f), at('site/public/v', pkg.version, f))

  console.log(`\n  frozen ${files.length} file(s) at /v/${pkg.version}/\n`)
  for (const f of files) console.log(`    /v/${pkg.version}/${f}`)
  console.log()
  return 0
}
