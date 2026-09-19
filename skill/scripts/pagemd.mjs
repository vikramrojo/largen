/* One markdown file per page.
 *
 * site/pages/*.md hold everything editorial about a page: frontmatter for the
 * shell, markdown for the prose, and `::directive` lines for the blocks that
 * are not documents — contract sections rendered from the single source, the
 * component catalog, the playground. The generator supplies the directive
 * implementations; this module only parses and assembles.
 *
 * Markdown runs render through renderMarkdown() inside a `.doc` block, so
 * prose gets the reading measure; each directive's output is a sibling block,
 * so wide content is not squeezed to 70ch. {{name}} placeholders resolve from
 * a values map. A placeholder with no value, a directive with no
 * implementation, and a `::pills`/`::cards` with no list to consume are all
 * errors, because each is a page quietly missing a piece.
 */
import { renderMarkdown } from './markdown.mjs'

/** Parse `---` frontmatter and split the body into markdown runs and
 *  directive calls. Directives that consume a list (`::pills`, `::cards`)
 *  take the immediately following `- ` lines as items. */
export function parsePage(src, file, listDirectives = new Set()) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n/)
  if (!m) throw new Error(`${file}: no frontmatter block`)
  const meta = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/)
    if (kv) meta[kv[1]] = kv[2].trim()
  }
  for (const key of ['title', 'description', 'route']) {
    if (!meta[key]) throw new Error(`${file}: frontmatter is missing "${key}"`)
  }

  const lines = src.slice(m[0].length).split('\n')
  const blocks = []
  const run = []
  const flush = () => {
    const text = run.join('\n').trim()
    if (text) blocks.push({ kind: 'md', text })
    run.length = 0
  }
  for (let i = 0; i < lines.length; i++) {
    const d = lines[i].match(/^::([\w-]+)(?:\s+(.*))?$/)
    if (!d) { run.push(lines[i]); continue }
    flush()
    const block = { kind: 'directive', name: d[1], arg: d[2]?.trim() || null, items: [] }
    if (listDirectives.has(d[1])) {
      let j = i + 1
      while (j < lines.length && !lines[j].trim()) j++
      while (j < lines.length && /^- /.test(lines[j])) {
        const item = lines[j].match(/^- \[([^\]]+)\]\(([^)\s]+)\)\s*(.*)$/)
        if (!item) throw new Error(`${file}: ::${d[1]} items must be "- [label](href) description", got: ${lines[j]}`)
        block.items.push({ label: item[1], href: item[2], desc: item[3] })
        j++
      }
      if (!block.items.length) throw new Error(`${file}: ::${d[1]} has no list to consume`)
      i = j - 1
    }
    blocks.push(block)
  }
  flush()
  return { meta, blocks }
}

const fill = (text, values, file) =>
  text.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    if (!(name in values)) throw new Error(`${file}: {{${name}}} has no value`)
    return String(values[name])
  })

/** Render a parsed page body. `directives` maps a name to
 *  (arg, items) => html. The `hero` frontmatter flag restyles the first
 *  markdown run as the homepage hero. */
export function renderPage({ meta, blocks }, { values, directives, file }) {
  const out = []
  let first = true
  for (const block of blocks) {
    if (block.kind === 'md') {
      let html = renderMarkdown(fill(block.text, values, file))
      if (first && meta.hero === 'true') {
        html = html
          .replace('class="page-title"', 'class="hero-title"')
          .replaceAll('<p class="doc-p">', '<p class="hero-lede">')
        out.push(`<section class="hero">\n${html}\n</section>`)
      } else {
        out.push(`<div class="doc">\n${html}\n</div>`)
      }
    } else {
      const impl = directives[block.name]
      if (!impl) throw new Error(`${file}: no directive "::${block.name}" — has: ${Object.keys(directives).join(', ')}`)
      out.push(impl(block.arg, block.items))
    }
    first = false
  }
  return out.join('\n\n')
}
