/* Regenerate the site's pages from site/pages/*.md.
 *
 * Each page is one markdown file: frontmatter for the shell, prose as
 * markdown, and `::directive` lines for the blocks that are not documents.
 * The contract directives render from site/mcp/contract.mjs, so every surface
 * that presents the contract stays generated from the one source; the numbers
 * are derived here and reach the prose as {{name}} placeholders.
 *
 * The exception is /docs/migrating, rendered from MIGRATING.md. The guide is
 * worth having as a file in the repository and as a page on the site, and
 * maintaining it twice would guarantee the two say different things.
 *
 * Output is committed static HTML. Running this is an author-time convenience
 * like `largen build`, not something the server does on the way to a response.
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { at } from './paths.mjs'
import { renderMarkdown } from './markdown.mjs'
import { parsePage, renderPage } from './pagemd.mjs'

const w = (p, s) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, s) }

export async function pages(args = []) {
  /* --check generates everything and compares, writing nothing.
     These pages are committed and served straight off disk, so nothing regenerates
     them at deploy time and nothing noticed when they stopped being true: the site
     advertised 0.2.0, and a pinned URL for it, for three releases. `largen contract
     --check` covers the surfaces it generates itself; this makes it cover these. */
  const check = args.includes('--check')
  const { page, inline, esc, MOVED } = await import('../../site/mcp/page.mjs')
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
  const c = buildContract()
  const COMPONENTS = manifest.components.length
  const TONES = manifest.axes.tone.values.length
  const VARIANTS = manifest.axes.variant.values.length
  const SIZES = manifest.axes.size.values.length
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

  /* What {{name}} resolves to in site/pages/*.md. Fragments only ever see the
     finished string, so a count can no more go stale in the copy than it could
     when the copy lived in template literals here. */
  const VALUES = {
    slots: SLOTS,
    tools: TOOLS,
    rules: words(c.rules.length),
    modes: words(c.failureModes.length),
    components: COMPONENTS,
    tones: words(TONES),
    variants: words(VARIANTS),
    sizes: words(SIZES),
    combos: TONES * VARIANTS * SIZES,
    utilities: words(c.utilities.list.length),
    compactTokens: COMPACT_TOKENS.toLocaleString('en-US'),
    conformance: words(CONFORMANCE),
    version: v,
  }

  const written = []
  const produced = new Map()
  const record = (rel, html) => { produced.set(rel, html); if (!check) w(at(rel), html); written.push(rel) }

  /* ── The reference component catalog ──────────────────────────────────
   *
   * Rendered, not listed. Every example is validated before it is rendered,
   * so the page cannot show something `validate_spec` would reject, and a
   * component missing an example fails generation rather than quietly
   * vanishing from the catalogue. */
  const { EXAMPLES, FRAGMENTS } = await import('../../components/examples.js')
  const { SOURCE } = await import('../../site/mcp/source.mjs')
  const { createValidator } = await import('../../genai/validate.js')
  const { renderNode } = await import('../../site/mcp/render.mjs')
  const { safeValidateNode } = createValidator(manifest)

  const uncovered = manifest.components.filter((x) => !EXAMPLES[x.name])
  if (uncovered.length) {
    throw new Error(
      `no example for: ${uncovered.map((x) => x.name).join(', ')}\n` +
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
  const ungrouped = manifest.components.filter((x) => !grouped.has(x.name))
  if (ungrouped.length) {
    throw new Error(`not in any group on the components catalogue: ${ungrouped.map((x) => x.name).join(', ')}`)
  }

  const byName = new Map(manifest.components.map((x) => [x.name, x]))
  const componentBlock = (name) => {
    const spec = EXAMPLES[name]
    const result = safeValidateNode(spec)
    if (!result.ok) throw new Error(`example for ${name} is invalid: ${result.error}`)
    const comp = byName.get(name)
    const source = SOURCE.get(name)
    return `  <section class="component" id="${name}">
    <div class="component-head">
      <span class="component-name">${name}</span>
      <span class="component-for">${esc(comp.for ?? '')}</span>
    </div>
    <div class="component-demo"${FRAGMENTS.has(name) ? ' data-fragment="true"' : ''}>
${renderNode(result.value, 3)}
    </div>
    <pre class="code component-source">${esc(source ? source.css : '/* no source found */')}</pre>
  </section>`
  }

  /* ── The playground widget ────────────────────────────────────────────── */

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

  const playgroundBlock = () => `<div class="play-grid">
    <div class="stack" style="--gap:.5rem">
      <label class="spec-note" for="spec">Spec</label>
      <textarea class="play-editor" id="spec" spellcheck="false">${esc(EXAMPLE)}</textarea>
      <div class="cluster" style="--gap:.6rem">
        <button id="share" data-tone="primary" data-variant="soft">Copy share link</button>
        <span class="spec-note" id="shared"></span>
      </div>
      <p class="spec-note">The share link carries the spec in the URL fragment, so it
      never reaches the server and needs nothing stored to work.</p>
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

  /* The paste-able generation prompt. genai/prompt.md is generated from the
     manifest by \`largen gen\`, so this block tracks the approved component
     set; the [instruction] line is where the reader writes what they want. */
  const genaiPromptBlock = () => {
    const prompt = readFileSync(at('genai/prompt.md'), 'utf8')
      .replace(/^<!--[\s\S]*?-->\n*/, '')
      .trimEnd()
    return `<pre class="code">${esc(
      '[instruction]: <what you want built — e.g. "a revenue card with a stat and a warning">\n\n' +
      prompt +
      '\n\nReturn only the JSON spec, nothing else.')}</pre>`
  }

  /* ── Contract sections, rendered from the single source ──────────────── */

  /* Multi-paragraph prose fields split on blank lines, one <p> each, instead
     of flowing as a wall. */
  const notes = (text) => String(text).split('\n\n')
    .map((para) => `<p class="spec-note">${inline(para)}</p>`).join('\n')

  const specRow = (name, note) =>
    `  <div class="spec-row"><span class="spec-name">${esc(name)}</span>` +
    `<span class="spec-note">${note ? inline(note) : ''}</span></div>`

  const CONTRACT_SECTIONS = {
    model: () => [
      `<pre class="code">${esc(c.overview.model)}</pre>`,
      notes(c.overview.why),
    ].join('\n'),
    example: () => [
      `<pre class="code">${esc(c.overview.example.css)}</pre>`,
      `<pre class="code">${esc(c.overview.example.html)}</pre>`,
      notes(c.overview.example.why),
    ].join('\n'),
    slots: () => [
      notes(c.slots.why),
      '<div class="stack" style="--gap:0">',
      ...c.slots.fixed.map((s) => specRow(s, 'registered `inherits: false`, no `initial-value`')),
      '</div>',
      `<pre class="code">${esc(c.slots.registrations.join('\n'))}</pre>`,
      notes(c.slots.inheriting.why),
      '<div class="stack" style="--gap:0">',
      ...c.slots.inheriting.registered.map((s) => specRow(s, 'registered `inherits: true`, type-checked and animatable')),
      ...c.slots.inheriting.ambient.map((s) => specRow(s, 'not registered, inherits because that is the default')),
      '</div>',
    ].join('\n'),
    paint: () => [
      `<pre class="code">${esc(c.paint.rule)}</pre>`,
      notes(c.paint.why),
    ].join('\n'),
    axes: () => Object.entries(c.axes).map(([name, a]) => [
      `<section class="stack" style="--gap:.6rem">`,
      `  <h3 class="section-title" id="axis-${name}">${esc(name)}</h3>`,
      '  <div class="stack" style="--gap:0">',
      specRow('attribute', a.attribute ? '`' + a.attribute + '`' : 'none, it comes from the DOM'),
      specRow('inherits', a.inherits === null ? 'from the DOM' : a.inherits ? 'yes' : 'no'),
      specRow('values', a.values.map((val) => '`' + val + '`').join(' · ')),
      '  </div>',
        notes(a.why),
      '</section>',
    ].join('\n')).join('\n'),
    layers: () => [
      `<pre class="code">${esc(c.layers.order.join('\n  < '))}</pre>`,
      notes(c.layers.why),
    ].join('\n'),
    rules: () => c.rules.map((r, i) => [
      '<div class="rule">',
      `  <span class="rule-title">${i + 1}. ${inline(r.title)}</span>`,
        notes(r.why).replaceAll('spec-note', 'rule-why'),
      '</div>',
    ].join('\n')).join('\n'),
    failures: () => c.failureModes.map((f, i) => [
      `<div class="failure" data-tone="${i === 0 ? 'danger' : 'warning'}">`,
      `  <span class="failure-symptom">${inline(f.symptom)}</span>`,
      `  <span class="failure-line"><strong>Cause</strong>: ${inline(f.cause)}</span>`,
      `  <span class="failure-line"><strong>Fix</strong>: ${inline(f.fix)}</span>`,
        notes(f.why).replaceAll('spec-note', 'failure-line'),
      '</div>',
    ].join('\n')).join('\n'),
    utilities: () => [
      notes(c.utilities.intro),
      '<div class="stack" style="--gap:0">',
      ...c.utilities.list.map((u) => specRow(u.name, `${u.does}. Reads \`${u.reads}\``)),
      '</div>',
      notes(c.utilities.alignment),
      notes(c.utilities.why),
    ].join('\n'),
  }

  /* ── The directive set site/pages/*.md may use ───────────────────────── */

  const card = (href, title, desc) =>
  `  <a class="doc-card" href="${href}">
      <span class="doc-card-title">${title}</span>
      <span class="doc-card-desc">${desc}</span>
    </a>`

  const directives = {
    contract: (arg) => {
      const section = CONTRACT_SECTIONS[arg]
      if (!section) throw new Error(`::contract ${arg} is not a section — has: ${Object.keys(CONTRACT_SECTIONS).join(', ')}`)
      return section()
    },
    components: () => GROUPS.map(([label, names]) => `<section class="stack" style="--gap:.6rem">
  <h3 class="section-title">${label}</h3>
${names.map(componentBlock).join('\n')}
</section>`).join('\n\n'),
    pills: (_, items) => [
      '<div class="cluster" style="--gap:.6rem">',
      ...items.map((it, i) =>
        `  <a class="pill" data-tone="${i === 0 ? 'primary' : 'neutral'}" href="${it.href}">${esc(it.label)}</a>`),
      '</div>',
    ].join('\n'),
    cards: (_, items) => [
      '<div class="grid" style="--min-item:16rem;--gap:.75rem">',
      ...items.map((it) => card(it.href, esc(it.label), inline(it.desc))),
      '</div>',
    ].join('\n'),
    playground: playgroundBlock,
    'genai-prompt': genaiPromptBlock,
    releases: () => `<p class="spec-note"><strong>${LATEST.version}</strong>: ${ticks(LATEST.summary)}</p>`,
  }

  /* ── The pages ────────────────────────────────────────────────────────── */

  const PAGES = ['index', 'contract', 'authoring', 'play', '404']
  for (const name of PAGES) {
    const file = `site/pages/${name}.md`
    const parsed = parsePage(readFileSync(at(file), 'utf8'), file, new Set(['pills', 'cards']))
    const body = renderPage(parsed, { values: VALUES, directives, file })
    record(parsed.meta.route, page({
      title: parsed.meta.title,
      description: parsed.meta.description
        .replace(/\{\{(\w+)\}\}/g, (_, k) => String(VALUES[k] ?? '')),
      current: parsed.meta.nav ?? null,
      version: v,
      body,
    }))
  }

  /* The page and the server cannot disagree about the tool set: every tool the
     server exposes must be named in authoring.md, and authoring.md must not
     name a tool the server lost. The last time this drifted the site said six
     tools for three releases while the server had twelve. */
  {
    const authoring = readFileSync(at('site/pages/authoring.md'), 'utf8')
    const missing = TOOL_DEFINITIONS.map((t) => t.name).filter((n) => !authoring.includes('`' + n + '`'))
    if (missing.length) {
      throw new Error(`site/pages/authoring.md does not mention: ${missing.join(', ')}`)
    }
    const named = [...authoring.matchAll(/`(\w+)`/g)].map((m) => m[1])
      .filter((n) => /^(get|list|validate|check|render|lookup|resolve|explain|emit)_/.test(n))
    const server = new Set(TOOL_DEFINITIONS.map((t) => t.name))
    const stale = named.filter((n) => !server.has(n))
    if (stale.length) {
      throw new Error(`site/pages/authoring.md names tool(s) the server does not expose: ${stale.join(', ')}`)
    }
  }

  /* Redirect targets must exist. server.mjs 301s the retired routes to
     anchors on the merged pages; an anchor that silently stopped existing
     would strand every old link at the top of the page. */
  for (const target of Object.values(MOVED)) {
    const [route, anchor] = target.split('#')
    const rel = `site/public${route}.html`
    const html = produced.get(rel)
    if (!html) throw new Error(`MOVED points at ${route}, which this run did not produce`)
    if (anchor && !html.includes(`id="${anchor}"`)) {
      throw new Error(`MOVED points at ${target}, but ${rel} has no id="${anchor}"`)
    }
  }

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
   * from package.json, the page list from the pages this run produced, the
   * skill digest from the skill's own bytes. Hand-writing any of them
   * recreates exactly the drift that had this site advertising six MCP tools when
   * there were twelve, and a pinned 0.2.0 three releases after 0.2.0.
   *
   * Not published here, deliberately: openid-configuration,
   * oauth-protected-resource and auth.md. This site has no authentication — the
   * MCP server is unauthenticated by design and says so — and those files would
   * describe an authorization server that does not exist. */

  const { canonical } = await import('../../site/canonical.mjs')
  const { createHash } = await import('node:crypto')

  /* The canonical page set, from this generator rather than a list beside it;
     the demos are hand-written and linked from the home page. */
  const urls = [...new Set(written.filter((rel) => rel.endsWith('.html')))]
    .map((rel) => rel.replace(/^site\/public/, ''))
    /* 404.html is not a page anyone should be sent to. */
    .filter((u) => u !== '/404.html')
    .map((u) => (u === '/index.html' ? '/' : u))
    /* The extensionless form, because that is what the nav links to and what
       the .html form now 301s to. A sitemap should name the canonical one. */
    .map((u) => u.replace(/\.html$/, ''))
    .concat(['/demo/conformance', '/demo/tests'])
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

  record('site/public/robots.txt', `# largen: a CSS scaffold for agents
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
    serverInfo: { name: 'largen', version: v, title: 'largen: a CSS scaffold for agents' },
    description:
      'Tools for authoring and debugging largen components: the contract, the reference ' +
      'component sources, a linter, a cascade resolver, and a browser probe. Every tool ' +
      'that reasons about components takes your own component manifest, because largen ' +
      "expects you to write your own and cannot know them.",
    transport: { type: 'streamable-http', endpoint: canonical('/api/mcp') },
    authentication: { type: 'none' },
    capabilities: { tools: { listChanged: false } },
    tools: TOOL_DEFINITIONS.map((t) => ({ name: t.name, title: t.title })),
    documentation: canonical('/docs/authoring'),
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
        `${SLOTS} slots, the four axes, the layer rule, and the ${VALUES.modes} ways a ` +
        'component silently fails.',
      url: canonical('/skill/SKILL.md'),
      sha256: createHash('sha256').update(skillBody).digest('hex'),
    }],
  }, null, 2) + '\n')

  /* API catalog — RFC 9727, linkset per RFC 9264. */
  record('site/public/.well-known/api-catalog', JSON.stringify({
    linkset: [{
      anchor: canonical('/api/mcp'),
      'service-doc': [{ href: canonical('/docs/authoring'), type: 'text/html', title: 'MCP server documentation' }],
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
