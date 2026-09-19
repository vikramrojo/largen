/* The pages' prose, loaded from markdown.
 *
 * The copy for the hand-written pages lives in site/copy/*.md so that editing
 * a sentence is editing markdown, not a single-quoted JS string. Structure
 * stays in pages.mjs; this module only turns named fragments of prose into the
 * HTML the pages have always emitted. `inline()` from markdown.mjs renders
 * `code` spans as <span class="tok">, which is the same markup the page shell
 * produces, so moving a paragraph here does not change its DOM.
 *
 * Derived values arrive as {{name}} placeholders. The numbers themselves are
 * still computed in pages.mjs from the real artifacts; a fragment only ever
 * sees the finished string. A placeholder with no value, a fragment that does
 * not exist, and a fragment nothing consumed are all errors, because each is a
 * way for the copy and the page to drift apart silently.
 */
import { readFileSync } from 'node:fs'
import { at } from './paths.mjs'
import { inline } from './markdown.mjs'

export function loadCopy(name, values = {}) {
  const file = `site/copy/${name}.md`
  const src = readFileSync(at(file), 'utf8')

  const fragments = new Map()
  let key = null
  const body = []
  const flush = () => {
    if (key === null) return
    const text = body.join('\n').trim()
    if (!text) throw new Error(`${file}: fragment "${key}" is empty`)
    fragments.set(key, text)
    body.length = 0
  }
  for (const line of src.split('\n')) {
    const h = line.match(/^##\s+(.+?)\s*$/)
    if (h) { flush(); key = h[1]; continue }
    if (key === null) {
      if (line.trim() && !/^#\s/.test(line)) {
        throw new Error(`${file}: prose before the first "## key" heading has no name and cannot be used`)
      }
      continue
    }
    body.push(line)
  }
  flush()

  const used = new Set()
  const fill = (key) => {
    if (!fragments.has(key)) {
      throw new Error(`${file}: no fragment "${key}" — has: ${[...fragments.keys()].join(', ')}`)
    }
    used.add(key)
    return fragments.get(key).replace(/\{\{(\w+)\}\}/g, (_, name) => {
      if (!(name in values)) throw new Error(`${file}: fragment "${key}" uses {{${name}}}, which has no value`)
      return String(values[name])
    })
  }

  /** One or more paragraphs, each wrapped in <p class="...">. */
  const frag = (key, cls = 'spec-note') =>
    fill(key).split(/\n{2,}/)
      .map((p) => `<p class="${cls}">${inline(p.replace(/\n/g, ' '))}</p>`)
      .join('\n    ')

  /** The inline-rendered text with no wrapper, for card and tool descriptions. */
  frag.raw = (key) => inline(fill(key).replace(/\n/g, ' '))

  /** Call after the page body is built. An authored fragment nothing rendered
   *  is not an error the page can show, so it has to be one the build does. */
  frag.assertAllUsed = () => {
    const orphans = [...fragments.keys()].filter((k) => !used.has(k))
    if (orphans.length) {
      throw new Error(`${file}: fragment(s) never used: ${orphans.join(', ')} — delete them or render them`)
    }
  }

  return frag
}
