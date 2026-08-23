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
import { readdirSync, mkdirSync, copyFileSync, existsSync, readFileSync } from 'node:fs'
import { at } from './paths.mjs'

export async function release(args = []) {
  const force = args.includes('--force')
  const pkg = JSON.parse(readFileSync(at('package.json'), 'utf8'))
  const dir = at('site/public/v', pkg.version)

  if (!existsSync(at('dist'))) throw new Error('no dist/ — run `largen build` first')

  if (existsSync(dir) && !force) {
    throw new Error(
      `site/public/v/${pkg.version}/ already exists.\n` +
      '  A published versioned path must always return the same bytes, so this\n' +
      '  will not overwrite it. Bump the version in package.json, or pass --force\n' +
      '  if nothing has consumed this path yet.')
  }

  mkdirSync(dir, { recursive: true })
  const files = readdirSync(at('dist')).filter((f) => f.endsWith('.css'))
  for (const f of files) copyFileSync(at('dist', f), at('site/public/v', pkg.version, f))

  console.log(`\n  frozen ${files.length} file(s) at /v/${pkg.version}/\n`)
  for (const f of files) console.log(`    /v/${pkg.version}/${f}`)
  console.log()
  return 0
}
