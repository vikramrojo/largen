#!/usr/bin/env node
/* largen.dev.
 *
 * Plain node:http. No framework, and no build step for the site it serves —
 * largen's argument is that a stylesheet needs neither, so a site that needed
 * either would be arguing against itself.
 *
 * The stylesheet is streamed straight out of dist/ rather than copied into
 * public/. A copy is a thing that can go stale, and a CDN quietly serving last
 * week's library is a bad failure. Versioned paths are the deliberate exception
 * and are snapshots — see `largen release`.
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, extname, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

import { handleMcpRequest } from './mcp/server.mjs'
import { Previews } from './mcp/previews.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const PUBLIC = join(here, 'public')
const DIST = join(root, 'dist')

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const PORT = Number(process.env.PORT ?? 8787)
const BASE_URL = process.env.LARGEN_BASE_URL ?? `http://127.0.0.1:${PORT}`

const previews = new Previews(join(here, '.previews'))

/* The build manifest, re-read when dist/build.json changes on disk. A deploy
   rebuilds and restarts, so a startup read would nearly always be enough — but
   "nearly always" is how a server ends up serving one file's bytes under another
   file's ETag. */
let manifestCache = { mtime: 0, data: null }
function buildManifest() {
  const file = join(DIST, 'build.json')
  try {
    const { mtimeMs } = statSync(file)
    if (mtimeMs !== manifestCache.mtime) {
      manifestCache = { mtime: mtimeMs, data: JSON.parse(readFileSync(file, 'utf8')) }
    }
  } catch { manifestCache = { mtime: 0, data: null } }
  return manifestCache.data
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'content-length': Buffer.byteLength(body), ...headers })
  res.end(body)
}

/* A subresource-integrity check on a cross-origin <link> requires `crossorigin`,
   and `crossorigin` requires the server to allow it — without this the browser
   cannot read the response to hash it, so it blocks the stylesheet no matter how
   correct the integrity string is. Publishing SRI without CORS would be
   publishing something nobody can use. Everything here is public static CSS. */
const CDN = { 'access-control-allow-origin': '*' }

/* Directories the site is allowed to serve from the repository. All of it is
   plain CSS and dependency-free ESM that is already public.
   Mounting these is what lets demo/*.html port to the site with no edits at all:
   their `../src/largen.css` resolves to `/src/largen.css` unchanged. A site that
   had to rewrite its own demo pages to serve them would be quietly admitting to a
   build step. */
const REPO_MOUNTS = ['src', 'themes', 'components', 'sites', 'genai', 'skill', 'demo', 'dist']

/** Join a URL path onto a base directory without letting it escape. Rejects
 *  anything that normalises outside the base, so `..` in a URL cannot reach the
 *  filesystem above it. */
function safeJoin(base, urlPath) {
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '')
  const full = join(base, clean)
  if (full !== base && !full.startsWith(base + sep)) return null
  return full
}

async function serveFile(res, file, { immutable = false, status = 200, etag = null, req = null, headers = {} } = {}) {
  try {
    const info = await stat(file)
    if (!info.isFile()) return false

    /* Content-derived when the manifest knows the file, size+mtime otherwise.
       A content ETag survives a redeploy that rebuilds identical bytes; a
       stat-derived one does not, which is the weaker but always-available
       fallback. */
    const tag = etag ?? `W/"${info.size.toString(16)}-${Math.round(info.mtimeMs).toString(16)}"`
    if (req && req.headers['if-none-match'] === tag) {
      res.writeHead(304, { etag: tag, ...headers })
      res.end()
      return true
    }

    const body = await readFile(file)
    /* Caller headers last, so they win. The extension map is a default, and a
       file whose media type is not implied by its extension — /.well-known/api-catalog
       is application/linkset+json with no extension at all — needs to be able to
       say so. Spreading them first silently discarded the override. */
    send(res, status, body, {
      etag: tag,
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': immutable
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=60',
      ...headers,
    })
    return true
  } catch { return false }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > 4 * 1024 * 1024) { reject(new Error('request body too large')); req.destroy(); return }
      chunks.push(c)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve(undefined)
      try { resolve(JSON.parse(raw)) } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

/* One line per request. A deployed service that cannot say what reached it is a
   service you debug by guessing — which is how an afternoon disappears. */
const LOG = process.env.LARGEN_LOG !== 'off'
const log = (req, path, note = '') => {
  if (!LOG) return
  console.log(`${req.method} ${path} ${note}`.trimEnd())
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`)
  const path = url.pathname

  try {
    /* --- MCP ------------------------------------------------------------- */
    if (path === '/api/mcp') {
      /* No server->client stream. The spec permits answering GET with 405 when
         the server does not offer one, and this server never pushes anything:
         it is stateless, every tool returns a single complete result, and there
         are no subscriptions or progress notifications.
     
         Declining it is also what makes this work behind a reverse proxy. A GET
         held open here occupies the connection, and an intermediary that
         serialises requests per connection — exe.dev's front door does — will
         queue every later POST behind a stream that never ends. The client then
         hangs without a single request reaching this process. */
      if (req.method === 'GET') {
        return send(res, 405, JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'this server does not offer a server-to-client stream' },
          id: null,
        }) + '\n', { 'content-type': TYPES['.json'], allow: 'POST, DELETE' })
      }
      const body = req.method === 'POST' ? await readBody(req) : undefined
      log(req, path, `method=${body?.method ?? '-'} id=${body?.id ?? '-'} ` +
        `proto=${req.headers['mcp-protocol-version'] ?? '-'} accept=${req.headers.accept ?? '-'}`)
      return await handleMcpRequest(req, res, body, {
        previews, baseUrl: BASE_URL, version: pkg.version,
      })
    }

    /* --- Health ------------------------------------------------------------ */
    if (path === '/health') {
      return send(res, 200, JSON.stringify({
        ok: true,
        service: 'largen.dev',
        version: pkg.version,
        /* What this server actually serves, not a pinned path it does not.
           The previous field named /v/<version>/largen.css, whose bytes differ
           from the /largen.css this same process returns. */
        build: buildManifest()?.build ?? null,
        serving: buildManifest()
          ? Object.fromEntries(Object.entries(buildManifest().files)
              .map(([f, e]) => [`/${f}`, { sha256: e.sha256, bytes: e.bytes }]))
          : null,
        note: 'Unversioned paths are not immutable. Pin by sha256, by the integrity ' +
          'string in /build.json, or use a /v/<version>/ path.',
        uptimeSeconds: Math.round(process.uptime()),
      }, null, 2) + '\n', { 'content-type': TYPES['.json'], 'cache-control': 'no-store' })
    }

    /* --- The renderer, for the playground ----------------------------------
     *
     * Served from its source rather than copied into public/, for the same
     * reason the stylesheet is streamed out of dist/: a copy is a thing that can
     * go stale, and a playground quietly running last week's renderer would
     * undercut the claim that it cannot disagree with the server. */
    if (path === '/site-render.mjs') {
      if (await serveFile(res, join(here, 'mcp', 'render.mjs'))) return
    }

    /* --- Stylesheet, current ---------------------------------------------- */
    if (path === '/build.json') {
      if (await serveFile(res, join(DIST, 'build.json'), { req, headers: CDN })) return
      return send(res, 503, 'not built — run `largen build`\n', { 'content-type': TYPES['.txt'] })
    }

    if (/^\/(largen|largen\.components|theme-dark|site-example)\.css$/.test(path)) {
      const name = path.slice(1)
      const entry = buildManifest()?.files?.[name]
      if (await serveFile(res, join(DIST, name),
        { req, etag: entry && `"${entry.sha256}"`, headers: CDN })) return
      return send(res, 503, 'stylesheet not built — run `largen build`\n',
        { 'content-type': TYPES['.txt'] })
    }

    /* --- Stylesheet, pinned. Snapshots, so these never change. ------------- */
    if (path.startsWith('/v/')) {
      const file = safeJoin(PUBLIC, path)
      if (file && await serveFile(res, file, { immutable: true, req, headers: CDN })) return
      return send(res, 404, 'no such version\n', { 'content-type': TYPES['.txt'] })
    }

    /* --- Stored previews ---------------------------------------------------- */
    if (path.startsWith('/play/')) {
      const rec = previews.get(path.slice('/play/'.length))
      if (!rec) {
        return send(res, 404,
          '<!doctype html><meta charset=utf-8><title>expired</title>' +
          '<link rel=stylesheet href="/largen.css"><body style="padding:2rem">' +
          '<h1>No such preview</h1><p>Previews expire after 24 hours. ' +
          'Call <code>render_spec</code> again, or use ' +
          '<a href="/play">the playground</a>.</p>',
          { 'content-type': TYPES['.html'] })
      }
      return send(res, 200, rec.document, { 'content-type': TYPES['.html'], 'cache-control': 'no-store' })
    }

    /* --- Repository mounts --------------------------------------------------- */
    const mount = REPO_MOUNTS.find((d) => path === `/${d}` || path.startsWith(`/${d}/`))
    if (mount) {
      const file = safeJoin(root, path)
      if (file) {
        if (await serveFile(res, file)) return
        if (await serveFile(res, join(file, 'index.html'))) return
      }
    }

    /* --- Discovery surfaces -------------------------------------------------- */

    /* RFC 8288 Link headers, so a client that fetches the homepage learns what is
       here without parsing HTML. Relative references by design: RFC 8288 resolves
       them against the request URL, so they stay correct on largen.exe.xyz and on
       largen.dev without the server knowing which one answered. */
    const LINKS = [
      '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
      '</docs/mcp.html>; rel="service-doc"; type="text/html"',
      '</.well-known/mcp/server-card.json>; rel="service-desc"; type="application/json"',
      '</llms-compact.txt>; rel="describedby"; type="text/plain"',
      '</sitemap.xml>; rel="sitemap"; type="application/xml"',
      '</health>; rel="status"; type="application/json"',
    ].join(', ')

    /* --- api-catalog ---------------------------------------------------------- */

    /* `/.well-known/api-catalog` has no file extension and a media type of its own
       (RFC 9727), so the extension-driven TYPES map cannot answer for it. Served
       explicitly rather than falling through to application/octet-stream, which is
       what a catalogue nobody can parse looks like. */
    if (path === '/.well-known/api-catalog') {
      const file = safeJoin(PUBLIC, path)
      if (file && await serveFile(res, file, {
        headers: { ...CDN, 'content-type': 'application/linkset+json; charset=utf-8' },
      })) return
    }

    /* --- Static site --------------------------------------------------------- */
    const rel = path === '/' ? '/index.html' : path
    const candidate = safeJoin(PUBLIC, rel)
    const linkHeader = path === '/' ? { link: LINKS } : {}
    if (candidate) {
      if (await serveFile(res, candidate, { headers: linkHeader })) return
      if (!extname(rel) && await serveFile(res, candidate + '.html')) return
      if (!extname(rel) && await serveFile(res, join(candidate, 'index.html'))) return
    }

    const notFound = join(PUBLIC, '404.html')
    if (await serveFile(res, notFound, { status: 404 })) return
    return send(res, 404, 'not found\n', { 'content-type': TYPES['.txt'] })
  } catch (error) {
    if (!res.headersSent) {
      send(res, 500, JSON.stringify({ ok: false, error: error.message }) + '\n',
        { 'content-type': TYPES['.json'] })
    }
  }
})

server.listen(PORT, () => {
  console.log(`largen.dev — http://127.0.0.1:${PORT}`)
  console.log(`  mcp     ${BASE_URL}/api/mcp`)
  console.log(`  health  ${BASE_URL}/health`)
})

export { server }
