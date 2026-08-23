/* Per-component CSS source, sliced out of the reference stylesheets.
 *
 * Two callers need the same slices: `get_component_source`, so an agent can copy
 * a component into its own project, and the documentation page, which shows each
 * component beside the CSS that produces it. Two implementations of "find this
 * component's source" would eventually disagree, and the disagreement would be
 * invisible — the page would show one thing and the tool would hand over another.
 *
 * The map is also the security boundary for the tool. A name arriving over the
 * network is looked up here and never joined onto a path, so there is no name a
 * caller can send that reaches a file: names are not how files are found.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

export const SOURCE_FILES = ['components/reference.css', 'components/prose.css', 'src/layout.css']

/* Blank out comments while preserving every offset, so a regex can find rule
   boundaries without seeing comment text — and the original string can still be
   sliced for the result. Stripping outright would work for matching and then
   hand back source with its explanations removed, which is most of what makes a
   reference component worth copying.

   This is not a refinement. Without it the last line of a multi-line comment
   matches as a selector (it is word characters with no brace or semicolon) and
   swallows the rule underneath it, so the real component silently disappears
   from the map. `get_component_source` answered "no such component" for
   `field-error` and `table-wrap` until this was fixed. */
function maskComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
}

function buildSourceMap() {
  const map = new Map()
  for (const file of SOURCE_FILES) {
    const css = read(file)
    const masked = maskComments(css)
    /* Match a rule whose selector list starts with `.name` and capture the whole
       rule, so a component's own block comes back intact and copy-pasteable. */
    const re = /(^[ \t]*)((?:\.[\w-]+|[\w-]+)(?:[^{};]*?))\{([^{}]*)\}/gm
    for (const m of masked.matchAll(re)) {
      const selector = m[2].trim().replace(/\s+/g, ' ')
      if (selector.startsWith('@')) continue
      /* Slice the real text at the matched offsets — comments and all. */
      const bodyStart = m.index + m[1].length + m[2].length + 1
      const body = css.slice(bodyStart, bodyStart + m[3].length)
      for (const part of selector.split(',').map((s) => s.trim())) {
        const base = part.replace(/[:[].*$/s, '')
        const nm = base.match(/^\.([a-zA-Z][\w-]*)$/)
        if (!nm) continue
        const name = nm[1]
        const block = `${selector} {${body.replace(/\s+$/, '')}\n}`
        const prev = map.get(name)
        map.set(name, prev ? { ...prev, css: `${prev.css}\n\n${block}` } : { name, file, css: block })
      }
    }
  }
  return map
}

export const SOURCE = buildSourceMap()

export default SOURCE
