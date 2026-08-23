#!/usr/bin/env node
/* largen CLI — all of it optional.
 *
 * largen is plain CSS; nothing here is required to use it. These are dev-time
 * conveniences:
 *
 *   largen build    concatenate + minify for CDN. NOT compilation — the same
 *                   stylesheet works unbuilt.
 *   largen verify   lint your components against the authoring contract.
 *   largen gen      regenerate the generative-UI artifacts from a manifest.
 *
 * Three more are repository-development commands. They reach into site/, which
 * is not part of the published package, and say so plainly if it is absent:
 *
 *   largen contract regenerate SKILL.md and the llms.txt files from the contract.
 *   largen manifest derive a component manifest from a project's CSS.
 *   largen release  freeze the current dist/ at an immutable versioned path.
 *   largen pages    regenerate the site's hand-written pages.
 */
import { build } from './build.mjs'
import { verify } from './verify.mjs'
import { gen } from './gen.mjs'
import { contract } from './contract.mjs'
import { manifest } from './manifest.mjs'
import { release } from './release.mjs'
import { pages } from './pages.mjs'

const [cmd, ...rest] = process.argv.slice(2)
const commands = { build, verify, gen, contract, manifest, release, pages }

if (!cmd || cmd === '--help' || cmd === '-h' || !commands[cmd]) {
  console.log(`
  largen — a property algebra for CSS

    largen build    bundle + minify to dist/ (optional; largen works unbuilt)
    largen verify   check components against the authoring contract
    largen gen      regenerate genai artifacts from genai/manifest.json

  Repository-development commands (need site/, not shipped on npm):

    largen contract regenerate SKILL.md + llms.txt from the authoring contract
    largen manifest <css...>   derive a component manifest from a project's CSS
    largen release  freeze dist/ at site/public/v/<version>/
    largen pages    regenerate the site's hand-written pages + migrating.html

  Nothing here is required. largen is a stylesheet.
`)
  process.exit(cmd && !commands[cmd] ? 1 : 0)
}

try {
  const code = await commands[cmd](rest)
  process.exit(code ?? 0)
} catch (error) {
  console.error(`\n  ${cmd} failed: ${error.message}\n`)
  process.exit(1)
}
