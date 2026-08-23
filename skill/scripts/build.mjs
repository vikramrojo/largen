/* Bundle and minify for CDN. This is packaging, not compilation — src/largen.css
 * is valid CSS and works as-is. Anything that made this step mandatory would be
 * a design failure, so the sizes below are informational, not a gate. */
import { bundle } from 'lightningcss'
import { gzipSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { root } from './paths.mjs'

// The floor set by @property, color-mix(), @layer, :where() and revert-layer.
const targets = { safari: (16 << 16) | (4 << 8), chrome: 111 << 16, firefox: 128 << 16 }
const kb = (n) => (n / 1024).toFixed(2) + 'kb'

const PROFILES = [
  ['largen.css', 'src/largen.css', 'the algebra + layout utilities — all you need'],
  ['largen.components.css', 'components/index.css', 'optional reference components'],
  ['theme-dark.css', 'themes/dark.css', 'eleven token overrides'],
  ['site-example.css', 'sites/example/index.css', 'a whole site: algebra + prose + theme + its own components'],
]

export async function build() {
  mkdirSync(join(root, 'dist'), { recursive: true })
  console.log('\n  largen build — concatenation and minification, not compilation\n')
  for (const [out, entry, note] of PROFILES) {
    const { code } = bundle({ filename: join(root, entry), minify: true, targets })
    writeFileSync(join(root, 'dist', out), code)
    console.log(`  ${out.padEnd(24)} ${kb(code.length).padStart(9)} ${kb(gzipSync(code).length).padStart(9)} gz`)
    console.log(`  ${''.padEnd(24)} ${note}`)
  }
  console.log()
}
