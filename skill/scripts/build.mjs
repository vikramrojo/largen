/* Bundle for CDN. This is packaging, not compilation — src/largen.css is valid
 * CSS and works as-is. Anything that made this step mandatory would be a design
 * failure, so the sizes below are informational, not a gate.
 *
 * It uses no third-party code. That is the point rather than an economy: a
 * library whose first sentence is "no build step, no preprocessor, no plugin"
 * should not need a Rust CSS toolchain on the host that publishes it. See
 * bundle.mjs for what was measured before removing the one that used to be here.
 */
import { gzipSync } from 'node:zlib'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { root } from './paths.mjs'
import { bundle } from './bundle.mjs'

const kb = (n) => (n / 1024).toFixed(2) + 'kb'

const PROFILES = [
  ['largen.css', 'src/largen.css', 'the algebra + layout utilities — all you need'],
  ['largen.components.css', 'components/index.css', 'optional reference components'],
  ['theme-dark.css', 'themes/dark.css', 'eleven token overrides'],
  ['site-example.css', 'sites/example/index.css', "a whole site: algebra + prose + theme + its own components"],
]

export async function build() {
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  /* `/*!` survives every minifier's comment stripping by convention, including
     this one's — a file on a CDN should be able to say what it is. */
  const banner = `/*! largen ${version} | MIT | https://largen.dev */`

  mkdirSync(join(root, 'dist'), { recursive: true })
  console.log('\n  largen build — concatenation and minification, not compilation\n')

  for (const [out, entry, note] of PROFILES) {
    const code = bundle(join(root, entry), banner)
    writeFileSync(join(root, 'dist', out), code)
    console.log(`  ${out.padEnd(24)} ${kb(code.length).padStart(9)} ${kb(gzipSync(code).length).padStart(9)} gz`)
    console.log(`  ${''.padEnd(24)} ${note}`)
  }
  console.log()
}
