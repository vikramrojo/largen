/* Preview storage.
 *
 * A real filesystem is the one thing the exe.dev VM buys us over an edge
 * runtime: previews are files with a TTL, not a key-value store with a cleanup
 * story. The ids are random rather than derived from content because a preview
 * URL is shared casually, and a guessable id plus a `css` parameter is a way to
 * put chosen markup at a plausible-looking largen.dev URL.
 */
import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

const TTL_MS = 24 * 60 * 60 * 1000
const ID = /^[0-9a-f]{16}$/

export class Previews {
  constructor(dir) {
    this.dir = dir
    mkdirSync(dir, { recursive: true })
  }

  put(record) {
    const id = randomBytes(8).toString('hex')
    writeFileSync(join(this.dir, `${id}.json`),
      JSON.stringify({ ...record, createdAt: Date.now() }))
    this.sweep()
    return id
  }

  /** Returns null for an unknown, expired, or malformed id. The id is checked
   *  against a pattern before it touches the filesystem — it arrives in a URL. */
  get(id) {
    if (typeof id !== 'string' || !ID.test(id)) return null
    const file = join(this.dir, `${id}.json`)
    if (!existsSync(file)) return null
    try {
      const rec = JSON.parse(readFileSync(file, 'utf8'))
      if (Date.now() - rec.createdAt > TTL_MS) { rmSync(file, { force: true }); return null }
      return rec
    } catch { return null }
  }

  sweep() {
    const now = Date.now()
    let removed = 0
    for (const f of readdirSync(this.dir)) {
      if (!f.endsWith('.json')) continue
      const p = join(this.dir, f)
      try {
        if (now - statSync(p).mtimeMs > TTL_MS) { rmSync(p, { force: true }); removed++ }
      } catch { /* raced with another sweep; nothing to do */ }
    }
    return removed
  }
}

export default Previews
