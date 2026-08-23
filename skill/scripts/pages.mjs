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

const w = (p, s) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, s) }

export async function pages() {
  const { page, esc } = await import('../../site/mcp/page.mjs')
  const { manifest } = await import('../../genai/validate.js')
  const v = JSON.parse(readFileSync(at('package.json'), 'utf8')).version
  const written = []
  const record = (rel, html) => { w(at(rel), html); written.push(rel) }

  const card = (href, title, desc) =>
  `  <a class="doc-card" href="${href}">
      <span class="doc-card-title">${title}</span>
      <span class="doc-card-desc">${desc}</span>
    </a>`
  
  /* ── Landing ─────────────────────────────────────────────────────────── */
  
  record('site/public/index.html', page({
    title: 'largen — a property algebra for CSS', current: null, version: v,
    description: 'A property algebra for CSS. Twelve slots, four axes, one paint rule, and components you write yourself. No build step.',
    body: `<section class="hero">
    <h1 class="hero-title">A property algebra for CSS.</h1>
    <p class="hero-lede">Twelve custom-property slots, four axes, one universal paint
    rule — and the components are yours. Plain CSS: no build step, no preprocessor,
    no plugin.</p>
    <div class="cluster" style="--gap:.6rem">
      <a class="pill" data-tone="primary" href="/docs/contract.html">Read the contract</a>
      <a class="pill" data-tone="neutral" href="/docs/mcp.html">MCP server</a>
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
    <p class="spec-note">Seven tones, four variants, five sizes, every state and both
    themes — none of which it mentions. Everything above the component row is already
    solved, so the component is the only thing left to write.</p>
  </section>
  
  <section class="stack" style="--gap:.75rem">
    <h2 class="section-title">It is not a catalog</h2>
    <p class="spec-note">Most CSS libraries ship components and ask you to configure
    them. largen ships the algebra underneath components and expects you to write your
    own, named in your application's own language — <span class="tok">.entry-card</span>,
    not <span class="tok">.card-lg-bordered</span>.</p>
    <p class="spec-note">That premise shapes the <a href="/docs/mcp.html">MCP server</a>
    too. It cannot know your components, so every tool takes an optional manifest of
    them and answers in your vocabulary rather than largen's.</p>
  </section>
  
  <section class="stack" style="--gap:.75rem">
    <h2 class="section-title">Start here</h2>
    <div class="grid" style="--min-item:16rem;--gap:.75rem">
  ${card('/docs/contract.html', 'The contract', 'Twelve slots, the layer rule, the paint rule. What the library guarantees.')}
  ${card('/docs/axes.html', 'The axes', 'tone, variant, size, state — and why only two of them inherit.')}
  ${card('/docs/authoring.html', 'Authoring', 'Six rules for writing a component, and the four ways it goes wrong.')}
  ${card('/docs/components.html', 'Reference components', 'Twenty-three optional components. Copy them or ignore them.')}
  ${card('/docs/mcp.html', 'MCP server', 'Six tools for agents. No API key, no generate_ui.')}
  ${card('/play', 'Playground', 'Render a spec. Share it in a URL with no server involved.')}
    </div>
  </section>
  
  <section class="stack" style="--gap:.5rem">
    <h2 class="section-title">Use it</h2>
    <pre class="code">${esc(`<link rel="stylesheet" href="https://largen.dev/largen.css">
  
  # or pinned, immutable:
  <link rel="stylesheet" href="https://largen.dev/v/${v}/largen.css">
  
  # or from npm:
  npm install largen`)}</pre>
    <p class="spec-note">For agents: <a href="/llms-compact.txt">/llms-compact.txt</a>
    carries the whole contract inline, about 2,400 tokens.</p>
  </section>`,
  }))
  
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

  const componentsBody = `<div class="stack" style="--gap:.4rem">
  <h1 class="page-title">Reference components</h1>
  <p class="page-desc">${manifest.components.length} components, each about six lines.
  Optional, and copy-in rather than imported — largen ships an algebra, not a
  dependency, so take the source and it is yours to edit.</p>
</div>

<section class="stack" style="--gap:.5rem">
  <p class="spec-note">There is no button here, and no input, select or table. Those are
  elements, and <span class="tok">src/elements.css</span> already themes them — they
  answer to <span class="tok">data-tone</span>, <span class="tok">data-variant</span> and
  <span class="tok">data-size</span> exactly like everything below. A component class
  duplicating them would be a worse copy of something the platform provides.</p>
  <p class="spec-note">Each example below is rendered from a validated spec by the same
  validator and renderer the <a href="/docs/mcp.html">MCP server</a> uses, so nothing on
  this page is something <span class="tok">validate_spec</span> would reject. Fetch any
  source with <span class="tok">get_component_source</span>, or read
  <a href="/components/reference.css">reference.css</a> whole.</p>
  <p class="spec-note"><strong>Every component below answers to all four axes</strong> —
  <span class="tok">data-tone</span>, <span class="tok">data-variant</span>,
  <span class="tok">data-size</span> and real DOM state — without naming any of them.
  That is not stated per component because it does not vary: it is the whole point of the
  algebra. Set <span class="tok">data-tone</span> on any ancestor and everything below
  re-tones.</p>
  <p class="spec-note">Entries marked <em>fragment</em> are meant to sit inside a parent;
  shown alone they are a piece, not a demonstration.</p>
</section>

${GROUPS.map(([label, names]) => `<section class="stack" style="--gap:.6rem">
  <h2 class="section-title">${label}</h2>
${names.map(componentBlock).join('\n')}
</section>`).join('\n\n')}

<section class="stack" style="--gap:.5rem">
  <h2 class="section-title">Using them</h2>
  <pre class="code">${esc(`<link rel="stylesheet" href="https://largen.dev/largen.css">
<link rel="stylesheet" href="https://largen.dev/largen.components.css">`)}</pre>
  <p class="spec-note">Or copy one component's source and skip the file entirely. That is
  the intended path — the set exists to be read and taken from, not depended on.</p>
</section>`

  record('site/public/docs/components.html', page({
    title: 'Reference components — largen', current: 'components', version: v,
    description: "largen's reference components, each shown rendered with its source. Copy them into your project or ignore them.",
    body: componentsBody,
  }))

  /* ── MCP ──────────────────────────────────────────────────────────────── */
  
  record('site/public/docs/mcp.html', page({
    title: 'MCP server — largen', current: 'mcp', version: v,
    description: 'Six MCP tools for agents building with largen. Streamable HTTP, no authentication, and deliberately no generate_ui.',
    body: `<div class="stack" style="--gap:.4rem">
    <h1 class="page-title">MCP server</h1>
    <p class="page-desc">Six tools, over Streamable HTTP, with no authentication.
    Everything here is public documentation or a pure function over what you send.</p>
  </div>
  
  <section class="stack" style="--gap:.5rem">
    <h2 class="section-title">Connect</h2>
    <pre class="code">${esc('claude mcp add largen --transport http https://largen.dev/api/mcp')}</pre>
    <p class="spec-note">No key, no account, no configuration.</p>
  </section>
  
  <section class="stack" style="--gap:.75rem">
    <h2 class="section-title">The tools</h2>
  
    <div class="tool">
      <span class="tool-name">get_contract</span>
      <p class="tool-desc">The slots, the axes and their permitted values, the layer
      rule, the authoring rules and the known failure modes. Takes an optional
      <span class="tok">section</span>. Call it before authoring a component.</p>
    </div>
  
    <div class="tool">
      <span class="tool-name">list_components</span>
      <p class="tool-desc">Every component a spec may name, with descriptions, elements,
      slots and permitted children.</p>
    </div>
  
    <div class="tool">
      <span class="tool-name">get_component_source</span>
      <p class="tool-desc">The CSS of one reference component, for copying in. Names are
      resolved against a known list and never against a path.</p>
    </div>
  
    <div class="tool">
      <span class="tool-name">validate_spec</span>
      <p class="tool-desc">Checks a model-emitted node tree against the allowlist.
      Rejects unknown components and axis values, and rejects
      <span class="tok">style</span>, <span class="tok">onclick</span>,
      <span class="tok">className</span> or
      <span class="tok">dangerouslySetInnerHTML</span> rather than dropping them —
      a model emitting one of those is a signal worth surfacing.</p>
    </div>
  
    <div class="tool">
      <span class="tool-name">check_component_css</span>
      <p class="tool-desc">Lints CSS you just wrote: layer membership, colour literals,
      reaching past the tone axis, unregistered slots. This tool has no equivalent
      elsewhere, because elsewhere the components are fixed. Here you write them, so the
      most useful thing a server can do is tell you whether what you wrote is correct.</p>
    </div>
  
    <div class="tool">
      <span class="tool-name">render_spec</span>
      <p class="tool-desc">Validates, renders, and returns the HTML inline plus a preview
      URL. Takes <span class="tok">theme</span> and <span class="tok">css</span>, so your
      own components appear as they do in your project.</p>
    </div>
  </section>
  
  <section class="stack" style="--gap:.5rem">
    <h2 class="section-title">Your components, not ours</h2>
    <p class="spec-note">largen's premise is that you write your own components, so a
    server holding a catalog could only ever describe largen's reference set — useless in
    the project you are actually working in. Instead every tool takes an optional
    <span class="tok">components</span> manifest.</p>
    <pre class="code">${esc('npx largen manifest src/components.css --out largen.manifest.json')}</pre>
    <p class="spec-note">Pass that object as <span class="tok">components</span> and the
    tools answer in your vocabulary. Omit it and they fall back to the reference set. A
    malformed manifest is an error, never a silent fallback — answering confidently in
    the wrong vocabulary is worse than refusing.</p>
  </section>
  
  <section class="stack" style="--gap:.5rem">
    <h2 class="section-title">There is no generate_ui</h2>
    <p class="spec-note">This is a position, not a gap.</p>
    <p class="spec-note">A <span class="tok">generate_ui</span> tool takes natural
    language and returns a UI spec, which requires a model on the server. You are already
    a capable model, and you know the application being built, its data and its
    conventions. A model here would know none of that, and would add an API key, a cost
    and a latency budget to every call in exchange for a worse answer.</p>
    <p class="spec-note">So this server equips you —
    <span class="tok">get_contract</span>, <span class="tok">list_components</span>,
    <span class="tok">get_component_source</span> — and then checks your work:
    <span class="tok">validate_spec</span>, <span class="tok">check_component_css</span>,
    <span class="tok">render_spec</span>. You do the generating.</p>
  </section>
  
  <section class="stack" style="--gap:.5rem">
    <h2 class="section-title">Without MCP</h2>
    <p class="spec-note">Fetch <a href="/llms-compact.txt">/llms-compact.txt</a>: the
    whole contract inline, roughly 2,400 tokens, enough to author a correct component
    without another request.</p>
  </section>`,
  }))
  
  /* ── 404 ──────────────────────────────────────────────────────────────── */
  
  record('site/public/404.html', page({
    title: 'Not found — largen', current: null, version: v,
    description: 'Not found.',
    body: `<div class="stack" style="--gap:.5rem">
    <h1 class="page-title">Not found</h1>
    <p class="page-desc">That page does not exist. Try
    <a href="/docs/contract.html">the contract</a> or
    <a href="/">the front page</a>.</p>
  </div>`,
  }))
  
  
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
  
  const body = `<div class="stack" style="--gap:.4rem">
    <h1 class="page-title">Playground</h1>
    <p class="page-desc">Edit a spec and watch it validate and render. The validator and
    the renderer here are the same modules the MCP server imports — not a reimplementation
    of them — so this page cannot disagree with <span class="tok">validate_spec</span>.</p>
  </div>
  
  <div class="play-grid">
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
      verdict.textContent = 'Not JSON — ' + e.message
      stage.innerHTML = ''
      return
    }
  
    const result = safeValidateNode(spec)
    if (!result.ok) {
      /* An invalid spec shows its errors and renders nothing. Partial output would
         be a picture of something the validator just refused to allow. */
      verdict.dataset.tone = 'danger'
      verdict.textContent = 'Rejected — ' + result.error
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
    title: 'Playground — largen', current: 'play', version: v,
    description: 'Render a largen spec in the browser. Shareable through the URL fragment, with nothing stored server-side.',
    body,
  }))
  
  /* The migration guide: one source, two surfaces. */
  const guide = renderMarkdown(readFileSync(at('MIGRATING.md'), 'utf8'))
  record('site/public/docs/migrating.html', page({
    title: 'Migrating to largen', current: 'migrating', version: v,
    description: 'A runbook for moving a site off Tailwind, daisyUI, CVA and a component registry onto largen.',
    body: `<article class="doc">\n${guide}\n</article>`,
  }))

  console.log(`\n  largen pages — ${written.length} pages\n`)
  for (const p of written) console.log(`    ${p}`)
  console.log()
  return 0
}
