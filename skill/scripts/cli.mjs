#!/usr/bin/env node
/* largen CLI — all of it optional.
 *
 * largen is plain CSS; nothing here is required to use it. These are dev-time
 * conveniences:
 *
 *   largen verify   lint your components against the authoring contract.
 *   largen build    concatenate + minify for CDN. NOT compilation — the same
 *                   stylesheet works unbuilt.
 *   largen gen      regenerate the generative-UI artifacts from a manifest.
 *   largen manifest derive a component manifest from a project's CSS.
 *
 * Three more exist only for developing largen itself — `contract`, `pages` and
 * `release` — and are not part of the published package.
 *
 * Commands are loaded on demand rather than imported at the top. That is not a
 * startup optimisation: the repository-only commands are absent from the
 * published package, and a static import of a missing module fails at load, so
 * every command including the shipped ones would break. Lazily, a missing module
 * is one command reporting why.
 */
const COMMANDS = {
  verify: { load: () => import('./verify.mjs'), blurb: 'check components against the authoring contract' },
  eval: { load: () => import('./eval.mjs'), blurb: 'score authored components against the contract — offline, deterministic' },
  build: { load: () => import('./build.mjs'), blurb: 'bundle + minify to dist/ — optional, for CDN' },
  gen: { load: () => import('./gen.mjs'), blurb: 'regenerate genai artifacts from genai/manifest.json' },
  manifest: { load: () => import('./manifest.mjs'), blurb: "derive a manifest from a project's CSS" },
  probe: { load: () => import('./probe.mjs'), blurb: 'emit a browser harness for what static checks cannot see' },
  cascade: { load: () => import('./cascade.mjs'), blurb: 'which declaration wins for a property, and why' },
  slot: { load: () => import('./cascade.mjs'), blurb: 'does the paint rule apply this slot, or does it revert?' },
  contract: { load: () => import('./contract.mjs'), blurb: 'regenerate SKILL.md + llms.txt', repoOnly: true },
  pages: { load: () => import('./pages.mjs'), blurb: "regenerate the site's hand-written pages", repoOnly: true },
  release: { load: () => import('./release.mjs'), blurb: 'freeze dist/ at an immutable versioned path', repoOnly: true },
  releases: { load: () => import('./releases.mjs'), blurb: 'the release log, and the check that it is true', repoOnly: true },
}

const [cmd, ...rest] = process.argv.slice(2)

const usage = () => {
  const width = Math.max(...Object.keys(COMMANDS).map((k) => k.length))
  const line = ([name, c]) => `    largen ${name.padEnd(width)}  ${c.blurb}`
  const entries = Object.entries(COMMANDS)
  console.log(`
  largen — a property algebra for CSS

${entries.filter(([, c]) => !c.repoOnly).map(line).join('\n')}

  For developing largen itself (not part of the published package):

${entries.filter(([, c]) => c.repoOnly).map(line).join('\n')}

  Nothing here is required. largen is a stylesheet.
`)
}

if (!cmd || cmd === '--help' || cmd === '-h' || !COMMANDS[cmd]) {
  usage()
  process.exit(cmd && !COMMANDS[cmd] ? 1 : 0)
}

const entry = COMMANDS[cmd]
let run
try {
  run = (await entry.load())[cmd]
} catch (error) {
  if (entry.repoOnly) {
    console.error(
      `\n  \`largen ${cmd}\` is for developing largen itself and is not part of the\n` +
      `  published package. Run it from a clone of the repository.\n`)
    process.exit(1)
  }
  throw error
}

try {
  process.exit((await run(rest)) ?? 0)
} catch (error) {
  console.error(`\n  ${cmd} failed: ${error.message}\n`)
  process.exit(1)
}
