/* The discovery surfaces, checked against the server that serves them.
 *
 * These files exist so that agent tooling can find what this site hosts without
 * being told. That makes them a species of claim — "there is an MCP server here,
 * with these tools", "there is a skill here, and here is its digest" — and this
 * repo does not publish claims it has not checked.
 *
 * The two that matter most are the ones nothing else would catch: a sitemap
 * listing a URL that 404s, and a digest that does not match the bytes it names.
 * Both look fine on inspection and are wrong.
 *
 *   node site/test/discovery.mjs                    # against localhost
 *   LARGEN_BASE_URL=https://largen.dev node …       # against the deployed origin
 */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const BASE = process.env.LARGEN_BASE_URL ?? 'http://127.0.0.1:8787'
const root = new URL('../../', import.meta.url).pathname

let pass = 0, fail = 0
const check = async (name, fn) => {
  try { const d = await fn(); pass++; console.log(`  ok    ${name}${d ? ` — ${d}` : ''}`) }
  catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`) }
}
const assert = (c, m) => { if (!c) throw new Error(m) }

const get = async (path) => {
  const res = await fetch(new URL(path, BASE))
  return { res, status: res.status, type: res.headers.get('content-type') ?? '', text: await res.text() }
}

/* These files publish ABSOLUTE canonical URLs, which is what the formats require
   and what makes them useful to a crawler. It also makes them awkward to test:
   run against localhost, every link points somewhere else.
 *
 * Resolving them verbatim is worse than it looks. The sitemap check did that at
 * first and passed — by fetching the deployed site, so it would have gone green
 * on a local sitemap that was completely broken. Rebasing onto the origin under
 * test makes a local run check the local files, and a run against the canonical
 * origin check reality, because there the rebase is a no-op. */
const { CANONICAL } = await import('../canonical.mjs')
const here = (url) => (url.startsWith(CANONICAL) ? new URL(url.slice(CANONICAL.length) || '/', BASE).href : url)
const rebasing = new URL(BASE).origin !== new URL(CANONICAL).origin

/* --- robots.txt ----------------------------------------------------------- */

const robots = await get('/robots.txt')

await check('robots.txt is served as plain text', () => {
  assert(robots.status === 200, `status ${robots.status}`)
  assert(/^text\/plain/.test(robots.type), `content-type ${robots.type}`)
  return robots.type
})

await check('robots.txt parses as RFC 9309 groups', () => {
  /* Every directive line is `field: value`, and every group opens with a
     User-agent. A file that reads correctly to a person and not to a parser is
     the failure this format has. */
  const lines = robots.text.split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
  let sawAgent = false
  for (const line of lines) {
    assert(/^[A-Za-z-]+:\s*\S/.test(line), `not a directive: ${line}`)
    const field = line.slice(0, line.indexOf(':')).toLowerCase()
    if (field === 'user-agent') { sawAgent = true; continue }
    if (field === 'sitemap') continue
    assert(sawAgent, `\`${field}\` appears before any User-agent group`)
  }
  const groups = lines.filter((l) => /^user-agent:/i.test(l)).length
  assert(groups > 1, 'no AI crawler groups')
  return `${groups} groups, ${lines.length} directives`
})

await check('robots.txt names a sitemap that resolves', async () => {
  const line = robots.text.split('\n').find((l) => /^sitemap:/i.test(l.trim()))
  assert(line, 'no Sitemap line')
  const url = line.slice(line.indexOf(':') + 1).trim()
  assert(url.startsWith(CANONICAL), `Sitemap line names ${url}, not the canonical origin`)
  const r = await fetch(here(url))
  assert(r.ok, `${url} returned ${r.status}`)
  return url
})

await check('robots.txt declares content signals', () => {
  const line = robots.text.split('\n').find((l) => /^content-signal:/i.test(l.trim()))
  assert(line, 'no Content-Signal directive')
  for (const key of ['ai-train', 'search', 'ai-input']) {
    assert(new RegExp(`${key}=`).test(line), `no ${key} preference`)
  }
  return line.trim()
})

/* --- sitemap.xml ---------------------------------------------------------- */

const sitemap = await get('/sitemap.xml')
const locs = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])

await check('sitemap.xml is served as XML', () => {
  assert(sitemap.status === 200, `status ${sitemap.status}`)
  assert(/xml/.test(sitemap.type), `content-type ${sitemap.type}`)
  assert(/<urlset[^>]+xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/.test(sitemap.text),
    'no sitemaps.org namespace')
  return `${locs.length} URLs`
})

await check('every URL in the sitemap resolves', async () => {
  /* All of them, not a sample. A sitemap that lists a dead URL is the one way
     this format fails, and it fails silently: the file is well-formed. */
  const dead = []
  for (const loc of locs) {
    assert(loc.startsWith(CANONICAL), `${loc} is not on the canonical origin`)
    const r = await fetch(here(loc), { redirect: 'follow' })
    if (!r.ok) dead.push(`${loc} → ${r.status}`)
  }
  assert(!dead.length, dead.join('; '))
  return `${locs.length}/${locs.length} return 200${rebasing ? ', resolved against ' + BASE : ''}`
})

await check('the sitemap lists the pages the site actually has', () => {
  /* Guards the other direction: a page added to the site and not to the sitemap. */
  for (const want of ['/', '/docs/contract.html', '/docs/mcp.html', '/play', '/demo/conformance.html']) {
    assert(locs.some((l) => new URL(l).pathname === want), `missing ${want}`)
  }
  assert(!locs.some((l) => new URL(l).pathname === '/404.html'), '404.html should not be in a sitemap')
  return 'home, docs, playground and demos present; 404 absent'
})

/* --- MCP server card ------------------------------------------------------ */

const card = await get('/.well-known/mcp/server-card.json')

await check('the MCP server card describes the endpoint that exists', async () => {
  assert(card.status === 200, `status ${card.status}`)
  const c = JSON.parse(card.text)
  assert(c.serverInfo?.name === 'largen', 'wrong server name')
  const health = JSON.parse((await get('/health')).text)
  assert(c.serverInfo.version === health.version,
    `card says ${c.serverInfo.version}, the server says ${health.version}`)
  assert(c.transport.endpoint.startsWith(CANONICAL), `endpoint ${c.transport.endpoint} is not on the canonical origin`)
  const endpoint = new URL(c.transport.endpoint).pathname
  assert(endpoint === '/api/mcp', `endpoint is ${endpoint}`)
  return `${c.serverInfo.name} ${c.serverInfo.version} at ${endpoint}`
})

await check('the card lists exactly the tools the server exposes', async () => {
  /* The drift this guards is not hypothetical: the site advertised six MCP tools
     for the several releases in which there were twelve. */
  const { TOOL_DEFINITIONS } = await import('../mcp/tools/index.mjs')
  const carded = JSON.parse(card.text).tools.map((t) => t.name).sort()
  const real = TOOL_DEFINITIONS.map((t) => t.name).sort()
  assert(JSON.stringify(carded) === JSON.stringify(real),
    `card: ${carded.join(',')}\n        server: ${real.join(',')}`)
  return `${real.length} tools`
})

await check('the card does not claim authentication the server does not have', () => {
  const c = JSON.parse(card.text)
  assert(c.authentication?.type === 'none', `claims auth: ${JSON.stringify(c.authentication)}`)
  return 'unauthenticated, and says so'
})

/* --- agent skills index --------------------------------------------------- */

const skills = await get('/.well-known/agent-skills/index.json')

await check('the skills index digest matches the bytes it names', async () => {
  /* A digest nobody verifies is decoration. Fetch the URL the index publishes and
     hash what comes back, rather than hashing the file next to the generator. */
  const s = JSON.parse(skills.text)
  const entry = s.skills[0]
  assert(entry.url.startsWith(CANONICAL), `${entry.url} is not on the canonical origin`)
  const served = await fetch(here(entry.url))
  assert(served.ok, `${entry.url} returned ${served.status}`)
  const bytes = Buffer.from(await served.arrayBuffer())
  const actual = createHash('sha256').update(bytes).digest('hex')
  assert(actual === entry.sha256,
    `index claims ${entry.sha256.slice(0, 16)}…, served bytes hash ${actual.slice(0, 16)}…`)
  return `${entry.name} — ${bytes.length} bytes, sha256 verified`
})

await check('the skills index entry has the fields the RFC requires', () => {
  const s = JSON.parse(skills.text)
  assert(s.$schema, 'no $schema')
  for (const f of ['name', 'type', 'description', 'url', 'sha256']) {
    assert(s.skills[0][f], `entry has no ${f}`)
  }
  return Object.keys(s.skills[0]).join(', ')
})

/* --- api catalog ---------------------------------------------------------- */

const catalog = await get('/.well-known/api-catalog')

await check('the api-catalog is a linkset with the right media type', () => {
  assert(catalog.status === 200, `status ${catalog.status}`)
  assert(/application\/linkset\+json/.test(catalog.type), `content-type ${catalog.type}`)
  const c = JSON.parse(catalog.text)
  assert(Array.isArray(c.linkset) && c.linkset.length, 'no linkset array')
  assert(c.linkset.every((e) => e.anchor), 'an entry has no anchor')
  return `${c.linkset.length} anchors`
})

await check('every link in the catalog resolves', async () => {
  const c = JSON.parse(catalog.text)
  const dead = []
  for (const entry of c.linkset) {
    for (const [rel, links] of Object.entries(entry)) {
      if (rel === 'anchor') continue
      for (const l of links) {
        const r = await fetch(here(l.href))
        if (!r.ok) dead.push(`${rel} ${l.href} → ${r.status}`)
      }
    }
    const r = await fetch(here(entry.anchor), { method: 'GET' })
    /* The MCP anchor answers POST only; a 405 proves it is there. */
    if (!r.ok && r.status !== 405) dead.push(`anchor ${entry.anchor} → ${r.status}`)
  }
  assert(!dead.length, dead.join('; '))
  return 'all anchors and links reachable'
})

/* --- Link headers --------------------------------------------------------- */

await check('the homepage carries RFC 8288 Link headers', async () => {
  const r = await fetch(new URL('/', BASE))
  const header = r.headers.get('link')
  assert(header, 'no Link header')
  const rels = [...header.matchAll(/rel="([^"]+)"/g)].map((m) => m[1])
  for (const want of ['api-catalog', 'service-doc', 'describedby']) {
    assert(rels.includes(want), `no rel="${want}"`)
  }
  return rels.join(', ')
})

await check('every Link target resolves', async () => {
  const r = await fetch(new URL('/', BASE))
  const targets = [...r.headers.get('link').matchAll(/<([^>]+)>/g)].map((m) => m[1])
  const dead = []
  for (const t of targets) {
    const res = await fetch(new URL(t, BASE))
    if (!res.ok) dead.push(`${t} → ${res.status}`)
  }
  assert(!dead.length, dead.join('; '))
  return `${targets.length} targets`
})

/* --- what is deliberately absent ------------------------------------------ */

await check('no authentication metadata is published for a site with no auth', async () => {
  /* These would describe an authorization server that does not exist. If one is
     ever added this test should be the thing that fails. */
  for (const p of ['/.well-known/openid-configuration',
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-protected-resource',
    '/auth.md']) {
    const r = await fetch(new URL(p, BASE))
    assert(r.status === 404, `${p} returned ${r.status} — it should not exist`)
  }
  return '4 absent, deliberately'
})

if (rebasing) {
  console.log(`\n  note: canonical origin is ${CANONICAL}; absolute URLs were resolved`)
  console.log(`  against ${BASE} so this run checks these files rather than the deployed ones.`)
}
console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
