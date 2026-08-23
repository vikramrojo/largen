/* Bundle and minify for CDN. This is packaging, not compilation — src/largen.css
 * is valid CSS and works as-is. Anything that made this step mandatory would be
 * a design failure, so the sizes below are informational, not a gate. */
let bundle
try {
  ({ bundle } = await import('lightningcss'))
} catch {
  /* lightningcss is a devDependency, so an installed copy will not have it. Say
     which package is missing rather than surfacing a resolution error — and say
     that not having it costs nothing, because the unbuilt stylesheet is the same
     stylesheet. */
  throw new Error(
    'largen build needs lightningcss, which is a development dependency:\n' +
    '    npm install --save-dev lightningcss\n' +
    '  It is only for producing dist/. largen works unbuilt — linking src/largen.css\n' +
    '  gives you exactly the same stylesheet.')
}
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
