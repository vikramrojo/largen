/* Regenerate the site's hand-written pages.
 *
 * These pages are prose about the project rather than presentations of the
 * authoring contract, so unlike the contract pages they are written here rather
 * than derived from a structured source. They still go through the same shell in
 * site/mcp/page.mjs, so their chrome cannot drift from the generated ones.
 *
 * The exception is /docs/migrating.html, which is rendered from MIGRATING.md.
 * The guide is worth having as a file in the repository and as a page on the
 * site, and maintaining it twice would guarantee the two say different things.
 *
 * Output is committed static HTML. Running this is an author-time convenience
 * like `largen build`, not something the server does on the way to a response.
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { at } from './paths.mjs'
import { renderMarkdown } from './markdown.mjs'
import { loadCopy } from './copy.mjs'

const w = (p, s) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, s) }

export async function pages(args = []) {
  /* --check generates everything and compares, writing nothing.
     These pages are committed and served straight off disk, so nothing regenerates
     them at deploy time and nothing noticed when they stopped being true: the site
     advertised 0.2.0, and a pinned URL for it, for three releases. `largen contract
     --check` covers the surfaces it generates itself; this makes it cover these. */
  const check = args.includes('--check')
  const { page, esc } = await import('../../site/mcp/page.mjs')
  const { manifest } = await import('../../genai/validate.js')
  const v = JSON.parse(readFileSync(at('package.json'), 'utf8')).version
  /* Derived, not spelled. A count written as a word goes stale silently — and
     every one of these had. The page said six MCP tools when there were twelve,
     twenty-three components when there were thirty-two, four failure modes when
     there were eight, and 2,400 tokens for a file that had grown by half. The
     slot count was the only one derived, and the only one still true. */
  const { registeredSlots } = await import('../../genai/lint.js')
  const SLOTS = registeredSlots(readFileSync(at('src/properties.css'), 'utf8')).length
  const { TOOL_DEFINITIONS } = await import('../../site/mcp/tools/index.mjs')
  const TOOLS = TOOL_DEFINITIONS.length
  const { buildContract } = await import('../../site/mcp/contract.mjs')
  const CONTRACT = buildContract()
  const RULES = CONTRACT.rules.length
  const MODES = CONTRACT.failureModes.length
  const COMPONENTS = manifest.components.length
  const TONES = manifest.axes.tone.values.length
  const VARIANTS = manifest.axes.variant.values.length
  const SIZES = manifest.axes.size.values.length
  const COMBOS = TONES * VARIANTS * SIZES
  /* Four characters per token is the usual rough conversion; rounded so the page
     does not imply a precision it does not have. */
  const COMPACT_TOKENS = Math.round(readFileSync(at('site/public/llms-compact.txt'), 'utf8').length / 400) * 100
  const CONFORMANCE = (readFileSync(at('demo/conformance.html'), 'utf8').match(/check\(/g) || []).length
  const RELEASES = JSON.parse(readFileSync(at('genai/releases.json'), 'utf8')).releases
  const LATEST = RELEASES[0]
  const words = (n) => ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
    'eight', 'nine', 'ten', 'eleven', 'twelve'][n] ?? String(n)
  /* The release log is authored as markdown and read as markdown everywhere else.
     Escape first, then promote code spans — the other order would let a summary
     inject markup. */
  const ticks = (text) => esc(text).replace(/`([^`]+)`/g, '<code>$1</code>')
  /* The prose, from site/copy/*.md. The numbers stay derived here; a fragment
     only ever sees the finished string, so a count can no more go stale in the
     copy than it could in the old template literals. */
  const VALUES = {
    slots: SLOTS,
    tools: TOOLS,
    rules: words(RULES),
    modes: words(MODES),
    components: COMPONENTS,
    tones: words(TONES),
    variants: words(VARIANTS),
    sizes: words(SIZES),
    combos: COMBOS,
    compactTokens: COMPACT_TOKENS.toLocaleString('en-US'),
    conformance: words(CONFORMANCE),
    version: v,
  }
  const copy = (name) => loadCopy(name, VALUES)

  const written = []
  const produced = new Map()
  const record = (rel, html) => { produced.set(rel, html); if (!check) w(at(rel), html); written.push(rel) }

  const card = (href, title, desc) =>
  `  <a class="doc-card" href="${href}">
      <span class="doc-card-title">${title}</span>
      <span class="doc-card-desc">${desc}</span>
    </a>`
  
  /* ── Landing ─────────────────────────────────────────────────────────── */
  
  const home = copy('index')
  record('site/public/index.html', page({
    title: 'largen: a property algebra for CSS', current: null, version: v,
    description: `A property algebra for CSS. ${SLOTS} slots, four axes, one paint rule, and components you write yourself. No build step.`,
    body: `<section class="hero">
    <h1 class="hero-title">A property algebra for CSS.</h1>
    ${home('hero-lede', 'hero-lede')}
    <div class="cluster" style="--gap:.6rem">
      <a class="pill" data-tone="primary" href="/docs/contract">Read the contract</a>
      <a class="pill" data-tone="neutral" href="/docs/mcp">MCP server</a>
      <a class="pill" data-tone="neutral" href="/play">Playground</a>
    </div>
  </section>
  
  <section class="stack" style="--gap:.75rem">
    <h2 class="section-title">A complete component</h2>
    <pre class="code">${esc(`@layer largen.components {
    .notification, notification {
      --bg: var(--tone-soft);
      --fg: var(--tone-ink);
      --border-width: 0 0 0 3px;
      --border-color: var(--tone);
      --border-style: solid;
      --radius: var(--radius-md);
      --pad: .75em 1em;
      --gap: .75em;
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
    }
  }`)}</pre>
    ${home('complete-component-note')}
  </section>

  <section class="stack" style="--gap:.75rem">
    <h2 class="section-title">Slots, the mechanism</h2>
    ${home('slots-intro')}
    <pre class="code">${esc(`.chip { --bg: var(--tone); }                     /* the component fills a blank */
* { background-color: var(--bg, revert-layer); } /* one shared rule applies it  */
[data-variant="outline"] { --bg: transparent; }  /* an axis changes the answer  */`)}</pre>
    ${home('slots-outro')}
  </section>

  <section class="stack" style="--gap:.75rem">
    <h2 class="section-title">Four features make it hold</h2>
    ${home('four-features')}
  </section>

  <section class="stack" style="--gap:.75rem">
    <h2 class="section-title">It is not a catalog</h2>
    ${home('not-a-catalog')}
  </section>

  <section class="stack" style="--gap:.75rem">
    <h2 class="section-title">Start here</h2>
    <div class="grid" style="--min-item:16rem;--gap:.75rem">
  ${card('/docs/contract', 'The contract', home.raw('card-contract'))}
  ${card('/docs/axes', 'The axes', home.raw('card-axes'))}
  ${card('/docs/authoring', 'Authoring', home.raw('card-authoring'))}
  ${card('/docs/components', 'Reference components', home.raw('card-components'))}
  ${card('/docs/mcp', 'MCP server', home.raw('card-mcp'))}
  ${card('/play', 'Playground', home.raw('card-play'))}
    </div>
  </section>
  
  <section class="stack" style="--gap:.5rem">
    <h2 class="section-title">Use it</h2>
    <pre class="code">${esc(`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/largen@latest/dist/largen.css">
  
  # or pinned. A published version is immutable:
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/largen@${v}/dist/largen.css">
  
  # or install it:
  npm install largen`)}</pre>
    ${home('use-note')}
  </section>

  <section class="stack" style="--gap:.75rem">
    <h2 class="section-title">Evidence, not a showcase</h2>
    ${home('evidence-intro')}
    <div class="grid" style="--min-item:16rem;--gap:.75rem">
  ${card('/demo/conformance.html', 'Conformance', home.raw('card-conformance'))}
  ${card('/demo/tests.html', 'The load-bearing tests', home.raw('card-tests'))}
    </div>
  </section>

  <section class="stack" style="--gap:.5rem">
    <h2 class="section-title">Releases</h2>
    <p class="spec-note"><strong>${LATEST.version}</strong>: ${ticks(LATEST.summary)}</p>
    ${home('releases-note')}
  </section>`,
  }))
  home.assertAllUsed()
  
  /* ── Reference components ─────────────────────────────────────────────
   *
   * Rendered, not listed. The page this replaces was a table of names that
   * showed nothing, which is a poor advertisement for a set whose whole pitch is
   * "read two of these and you know how to write the rest".
   *
   * Every example is validated before it is rendered, so this page cannot show
   * something `validate_spec` would reject, and a component missing an example
   * fails generation rather than quietly vanishing from the catalogue. */
  const { EXAMPLES, FRAGMENTS } = await import('../../components/examples.js')
  const { SOURCE } = await import('../../site/mcp/source.mjs')
  const { createValidator } = await import('../../genai/validate.js')
  const { renderNode } = await import('../../site/mcp/render.mjs')
  const { safeValidateNode } = createValidator(manifest)

  const uncovered = manifest.components.filter((c) => !EXAMPLES[c.name])
  if (uncovered.length) {
    throw new Error(
      `no example for: ${uncovered.map((c) => c.name).join(', ')}\n` +
      '  Every component in genai/manifest.json needs one in components/examples.js,\n' +
      '  or the page silently under-reports the catalogue.')
  }

  const GROUPS = [
    ['Feedback', ['alert', 'badge', 'dot', 'spinner', 'skeleton']],
    ['Surfaces', ['card', 'panel', 'divider']],
    ['Data', ['stat', 'stat-label', 'stat-value']],
    ['Forms', ['field', 'field-label', 'field-hint', 'field-error']],
    ['Containers', ['table-wrap', 'toolbar']],
    ['Empty state', ['empty', 'empty-title', 'empty-note']],
    ['Navigation', ['menu', 'crumbs', 'steps']],
    ['Conversation', ['bubble', 'avatar']],
    ['Overlay', ['tip']],
    ['Text', ['prose']],
    ['Layout utilities', ['stack', 'row', 'cluster', 'grid', 'center']],
  ]

  const grouped = new Set(GROUPS.flatMap(([, names]) => names))
  const ungrouped = manifest.components.filter((c) => !grouped.has(c.name))
  if (ungrouped.length) {
    throw new Error(`not in any group on the components page: ${ungrouped.map((c) => c.name).join(', ')}`)
  }

  const byName = new Map(manifest.components.map((c) => [c.name, c]))
  const componentBlock = (name) => {
    const spec = EXAMPLES[name]
    const result = safeValidateNode(spec)
    if (!result.ok) throw new Error(`example for ${name} is invalid: ${result.error}`)
    const c = byName.get(name)
    const source = SOURCE.get(name)
    return `  <section class="component" id="${name}">
    <div class="component-head">
      <span class="component-name">${name}</span>
      <span class="component-for">${esc(c.for ?? '')}</span>
    </div>
    <div class="component-demo"${FRAGMENTS.has(name) ? ' data-fragment="true"' : ''}>
${renderNode(result.value, 3)}
    </div>
    <pre class="code component-source">${esc(source ? source.css : '/* no source found */')}</pre>
  </section>`
  }

  const comps = copy('components')
  const componentsBody = `<div class="stack" style="--gap:.4rem">
  <h1 class="page-title">Reference components</h1>
  ${comps('page-desc', 'page-desc')}
</div>

<section class="stack" style="--gap:.5rem">
  ${comps('intro')}
</section>

${GROUPS.map(([label, names]) => `<section class="stack" style="--gap:.6rem">
  <h2 class="section-title">${label}</h2>
${names.map(componentBlock).join('\n')}
</section>`).join('\n\n')}

<section class="stack" style="--gap:.5rem">
  <h2 class="section-title">Using them</h2>
  <pre class="code">${esc(`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/largen@latest/dist/largen.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/largen@latest/dist/largen.components.css">`)}</pre>
  ${comps('using-note')}
</section>`

  record('site/public/docs/components.html', page({
    title: 'Reference components · largen', current: 'components', version: v,
    description: "largen's reference components, each shown rendered with its source. Copy them into your project or ignore them.",
    body: componentsBody,
  }))
  comps.assertAllUsed()

  /* ── MCP ──────────────────────────────────────────────────────────────── */
  
  const mcp = copy('mcp')

  /* The page's tool order, checked against the server's tool set. The order is
     editorial (orientation tools first, then checks, then diagnostics); the SET
     is not, and a tool the server gained or lost fails generation here rather
     than leaving the page quietly under- or over-reporting — which it did once,
     for six tools and three releases. */
  const TOOL_ORDER = ['get_contract', 'list_components', 'get_component_source',
    'validate_spec', 'check_component_css', 'render_spec', 'lookup_property',
    'check_layer_order', 'resolve_cascade', 'explain_slot', 'emit_probe', 'get_build']
  {
    const server = TOOL_DEFINITIONS.map((t) => t.name).sort()
    const listed = [...TOOL_ORDER].sort()
    if (server.join() !== listed.join()) {
      throw new Error('docs/mcp.html lists different tools than the server exposes:\n' +
        `  server: ${server.join(', ')}\n  page:   ${listed.join(', ')}`)
    }
  }
  const toolBlock = (name) => `    <div class="tool">
      <span class="tool-name">${name}</span>
      <p class="tool-desc">${mcp.raw(`tool-${name}`)}</p>
    </div>`

  record('site/public/docs/mcp.html', page({
    title: 'MCP server · largen', current: 'mcp', version: v,
    description: `${TOOLS} MCP tools for agents building with largen. Streamable HTTP, no authentication, and deliberately no generate_ui.`,
    body: `<div class="stack" style="--gap:.4rem">
    <h1 class="page-title">MCP server</h1>
    ${mcp('page-desc', 'page-desc')}
  </div>

  <section class="stack" style="--gap:.5rem">
    <h2 class="section-title">Connect</h2>
    <pre class="code">${esc('claude mcp add largen --transport http https://largen.dev/api/mcp')}</pre>
    ${mcp('connect-note')}
  </section>

  <section class="stack" style="--gap:.75rem">
    <h2 class="section-title">The tools</h2>

${TOOL_ORDER.map(toolBlock).join('\n  \n')}
  </section>

  <section class="stack" style="--gap:.5rem">
    <h2 class="section-title">Your components, not ours</h2>
    ${mcp('yours-not-ours')}
    <pre class="code">${esc('npx largen manifest src/components.css --out largen.manifest.json')}</pre>
    ${mcp('yours-not-ours-note')}
  </section>

  <section class="stack" style="--gap:.5rem">
    <h2 class="section-title">There is no generate_ui</h2>
    ${mcp('no-generate-ui')}
  </section>

  <section class="stack" style="--gap:.5rem">
    <h2 class="section-title">Without MCP</h2>
    ${mcp('without-mcp')}
  </section>`,
  }))
  mcp.assertAllUsed()
  
  /* ── 404 ──────────────────────────────────────────────────────────────── */
  
  const lost = copy('404')
  record('site/public/404.html', page({
    title: 'Not found · largen', current: null, version: v,
    description: 'Not found.',
    body: `<div class="stack" style="--gap:.5rem">
    <h1 class="page-title">Not found</h1>
    ${lost('page-desc', 'page-desc')}
  </div>`,
  }))
  lost.assertAllUsed()
  
  
    const EXAMPLE = JSON.stringify({
    component: 'card',
    tone: 'info',
    children: [
      { component: 'stat', children: [
        { component: 'stat-label', text: 'Revenue' },
        { component: 'stat-value', text: '$4,201' }]},
      { component: 'badge', tone: 'success', variant: 'soft', text: 'up 12%' },
      { component: 'alert', tone: 'warning', text: 'Two accounts need review.' },
    ],
  }, null, 2)
  
  const play = copy('play')
  const body = `<div class="stack" style="--gap:.4rem">
    <h1 class="page-title">Playground</h1>
    ${play('page-desc', 'page-desc')}
  </div>
  
  <div class="play-grid">
    <div class="stack" style="--gap:.5rem">
      <label class="spec-note" for="spec">Spec</label>
      <textarea class="play-editor" id="spec" spellcheck="false">${esc(EXAMPLE)}</textarea>
      <div class="cluster" style="--gap:.6rem">
        <button id="share" data-tone="primary" data-variant="soft">Copy share link</button>
        <span class="spec-note" id="shared"></span>
      </div>
      ${play('share-note')}
    </div>
  
    <div class="stack" style="--gap:.5rem">
      <span class="spec-note">Result</span>
      <div class="play-verdict" id="verdict" data-tone="neutral">…</div>
      <div class="play-stage" id="stage"></div>
    </div>
  </div>
  
  <script type="module">
  import { createValidator, manifest } from '/genai/validate.js'
  import { renderNode } from '/site-render.mjs'
  
  const $ = (id) => document.getElementById(id)
  const editor = $('spec'), verdict = $('verdict'), stage = $('stage')
  const { safeValidateNode } = createValidator(manifest)
  
  function run() {
    let spec
    try { spec = JSON.parse(editor.value) }
    catch (e) {
      verdict.dataset.tone = 'danger'
      verdict.textContent = 'Not JSON: ' + e.message
      stage.innerHTML = ''
      return
    }
  
    const result = safeValidateNode(spec)
    if (!result.ok) {
      /* An invalid spec shows its errors and renders nothing. Partial output would
         be a picture of something the validator just refused to allow. */
      verdict.dataset.tone = 'danger'
      verdict.textContent = 'Rejected: ' + result.error
      stage.innerHTML = ''
      return
    }
  
    verdict.dataset.tone = 'success'
    verdict.textContent = 'Valid.'
    stage.innerHTML = renderNode(result.value)
  }
  
  /* A spec in the fragment renders with no server round-trip, which is what makes a
     preview shareable without anything being stored anywhere. */
  function fromFragment() {
    const raw = location.hash.slice(1)
    if (!raw) return false
    try {
      editor.value = JSON.stringify(JSON.parse(decodeURIComponent(escape(atob(raw)))), null, 2)
      return true
    } catch (e) { return false }
  }
  
  $('share').addEventListener('click', () => {
    try {
      const packed = btoa(unescape(encodeURIComponent(JSON.stringify(JSON.parse(editor.value)))))
      const url = location.origin + location.pathname + '#' + packed
      history.replaceState(null, '', '#' + packed)
      navigator.clipboard?.writeText(url)
      $('shared').textContent = 'copied'
      setTimeout(() => { $('shared').textContent = '' }, 2000)
    } catch (e) { $('shared').textContent = 'fix the JSON first' }
  })
  
  editor.addEventListener('input', run)
  window.addEventListener('hashchange', () => { fromFragment(); run() })
  fromFragment()
  run()
  </script>`
  
    record('site/public/play.html', page({
    title: 'Playground · largen', current: 'play', version: v,
    description: 'Render a largen spec in the browser. Shareable through the URL fragment, with nothing stored server-side.',
    body,
  }))
  play.assertAllUsed()
  
  /* The migration guide: one source, two surfaces. */
  const guide = renderMarkdown(readFileSync(at('MIGRATING.md'), 'utf8'))
  record('site/public/docs/migrating.html', page({
    title: 'Migrating to largen', current: 'migrating', version: v,
    description: 'A runbook for moving a site off Tailwind, daisyUI, CVA and a component registry onto largen.',
    body: `<article class="doc">\n${guide}\n</article>`,
  }))


  /* ── Discovery surfaces ────────────────────────────────────────────────
   *
   * How an agent, or the tooling a harness builder assembles, finds what this
   * site hosts. largen ships two things that matter here and neither was
   * discoverable: a real MCP server at /api/mcp and a real skill at
   * /skill/SKILL.md, both already served, both invisible to the mechanisms
   * designed to find them.
   *
   * Every one is DERIVED. The tool list comes from TOOL_DEFINITIONS, the version
   * from package.json, the page list from the two generators that produce the
   * pages, the skill digest from the skill's own bytes. Hand-writing any of them
   * recreates exactly the drift that had this site advertising six MCP tools when
   * there were twelve, and a pinned 0.2.0 three releases after 0.2.0.
   *
   * Not published here, deliberately: openid-configuration,
   * oauth-protected-resource and auth.md. This site has no authentication — the
   * MCP server is unauthenticated by design and says so — and those files would
   * describe an authorization server that does not exist. */

  const { CANONICAL, canonical } = await import('../../site/canonical.mjs')
  const { createHash } = await import('node:crypto')
  const { contractPages } = await import('./contract.mjs')

  /* The canonical page set, from the generators rather than a list beside them.
     `written` holds this file's pages; contractPages holds the ones `largen
     contract` produces; the demos are hand-written and linked from the home page. */
  const contractPaths = Object.keys(contractPages(CONTRACT, page, (await import('../../site/mcp/page.mjs')).inline, esc))
  const urls = [...new Set([
    ...written.filter((rel) => rel.endsWith('.html')),
    ...contractPaths,
  ])]
    .map((rel) => rel.replace(/^site\/public/, ''))
    /* 404.html is not a page anyone should be sent to. */
    .filter((u) => u !== '/404.html')
    .map((u) => (u === '/index.html' ? '/' : u))
    /* The extensionless form, because that is what the nav links to and what
       the .html form now 301s to. A sitemap should name the canonical one. */
    .map((u) => u.replace(/\.html$/, ''))
    .concat(['/demo/conformance.html', '/demo/tests.html'])
    .sort()

  /* One date for every entry rather than per-file mtimes. A mtime differs between
     checkouts, and these files are compared byte-for-byte by `contract --check`,
     so a timestamp that moves would fail the check on whoever cloned last. The
     release date is the honest answer to "when did this site last change": the
     pages are regenerated as part of cutting one. */
  const lastmod = LATEST.date

  record('site/public/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${esc(canonical(u))}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`).join('\n')}
</urlset>
`)

  /* Allow everything. largen publishes llms-compact.txt and an MCP server so that
     models can read it; declining to be read would contradict the product. The
     Content-Signal line states that as an intention rather than leaving it to be
     inferred from silence. */
  const AI_AGENTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web',
    'Claude-SearchBot', 'Google-Extended', 'PerplexityBot', 'Applebot-Extended', 'CCBot']

  record('site/public/robots.txt', `# largen: a property algebra for CSS
#
# Everything here is meant to be read, by people and by models alike. The
# contract is published inline at /llms-compact.txt for exactly that reason, and
# the MCP server at /api/mcp is unauthenticated by design.
#
# Content-Signal: https://contentsignals.org/

User-agent: *
Content-Signal: ai-train=yes, search=yes, ai-input=yes
Allow: /

${AI_AGENTS.map((ua) => `User-agent: ${ua}\nAllow: /\n`).join('\n')}
Sitemap: ${canonical('/sitemap.xml')}
`)

  /* MCP Server Card — SEP-1649, still an open pull request against the spec, so
     the shape here may move. Recorded as a comment in the document rather than
     left for a reader to discover by diffing it against a schema. */
  record('site/public/.well-known/mcp/server-card.json', JSON.stringify({
    $comment:
      'MCP Server Card per SEP-1649, which is not yet merged. See ' +
      'modelcontextprotocol/modelcontextprotocol#2127. Generated by `largen pages` ' +
      'from the running server definition, so the tool list cannot drift from the ' +
      'tools the endpoint actually exposes.',
    serverInfo: { name: 'largen', version: v, title: 'largen: a property algebra for CSS' },
    description:
      'Tools for authoring and debugging largen components: the contract, the reference ' +
      'component sources, a linter, a cascade resolver, and a browser probe. Every tool ' +
      'that reasons about components takes your own component manifest, because largen ' +
      "expects you to write your own and cannot know them.",
    transport: { type: 'streamable-http', endpoint: canonical('/api/mcp') },
    authentication: { type: 'none' },
    capabilities: { tools: { listChanged: false } },
    tools: TOOL_DEFINITIONS.map((t) => ({ name: t.name, title: t.title })),
    documentation: canonical('/docs/mcp'),
  }, null, 2) + '\n')

  /* Agent Skills discovery index — Agent Skills Discovery RFC v0.2.0. The digest
     is of the bytes /skill/SKILL.md actually serves, and a test asserts that,
     because a digest nobody verifies is decoration. */
  const skillBody = readFileSync(at('skill/SKILL.md'))
  record('site/public/.well-known/agent-skills/index.json', JSON.stringify({
    $schema: 'https://agentskills.io/schemas/index-v0.2.0.json',
    $comment:
      'Agent Skills Discovery RFC v0.2.0, pre-standard. Generated by `largen pages`; ' +
      'the sha256 is of the bytes served at the url below and is checked against them.',
    skills: [{
      name: 'largen',
      type: 'skill',
      description:
        'Author, review, or debug CSS components with largen, a property algebra where ' +
        'components are custom-property bundles rather than modifier classes. Covers the ' +
        `${SLOTS} slots, the four axes, the layer rule, and the ${words(MODES)} ways a ` +
        'component silently fails.',
      url: canonical('/skill/SKILL.md'),
      sha256: createHash('sha256').update(skillBody).digest('hex'),
    }],
  }, null, 2) + '\n')

  /* API catalog — RFC 9727, linkset per RFC 9264. */
  record('site/public/.well-known/api-catalog', JSON.stringify({
    linkset: [{
      anchor: canonical('/api/mcp'),
      'service-doc': [{ href: canonical('/docs/mcp'), type: 'text/html', title: 'MCP server documentation' }],
      'service-desc': [{ href: canonical('/.well-known/mcp/server-card.json'), type: 'application/json', title: 'MCP server card' }],
      status: [{ href: canonical('/health'), type: 'application/json', title: 'Health' }],
    }, {
      anchor: canonical('/largen.css'),
      describedby: [{ href: canonical('/llms-compact.txt'), type: 'text/plain', title: 'The authoring contract, inline' }],
      'service-desc': [{ href: canonical('/build.json'), type: 'application/json', title: 'Byte lengths, sha256 and SRI for every stylesheet served' }],
    }],
  }, null, 2) + '\n')

  /* Every surface this function produces, compared after all of them exist.
     Sitting this block earlier meant `return 0` fired before the discovery files
     were recorded, so `largen pages` wrote five files that --check never opened —
     the same shape as the three bugs before it, this time introduced by the fix
     for one of them. The comparison belongs after the last record(), not in the
     middle. */
  if (check) {
    const stale = []
    for (const [rel, html] of produced) {
      let current = null
      try { current = readFileSync(at(rel), 'utf8') } catch { /* absent counts as stale */ }
      if (current !== html) stale.push(rel)
    }
    if (stale.length) {
      throw new Error(`out of date — run \`largen pages\`:\n${stale.map((f) => `    ${f}`).join('\n')}`)
    }
    console.log(`\n  pages: ${produced.size} generated page(s) are current\n`)
    return 0
  }

  console.log(`\n  largen pages — ${written.length} pages\n`)
  for (const p of written) console.log(`    ${p}`)
  console.log()
  return 0
}
