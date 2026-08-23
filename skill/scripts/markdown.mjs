/* A Markdown renderer covering exactly what the repository's docs use.
 *
 * Not a general Markdown implementation, and deliberately not a dependency. The
 * site's argument is that it needs no build step, so pulling in a parser to
 * produce its pages would be arguing against it. This runs at author time and
 * its output is committed static HTML.
 *
 * Handles: ATX headings, paragraphs, fenced code, unordered and ordered lists,
 * pipe tables, horizontal rules, and inline code/strong/em/links. Anything else
 * falls through as a paragraph — a visible failure rather than a silent one.
 */

export const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const OPEN = ''   /* private-use sentinels: cannot occur in real prose */
const CLOSE = ''

/** Inline spans. Code is lifted out first, so `**` or `_` inside a code span is
 *  never mistaken for emphasis — the commonest way a naive renderer mangles
 *  technical writing, and this file is full of `--tone: var(--danger)`. */
export function inline(text) {
  const code = []
  let t = String(text).replace(/`([^`]+)`/g, (_, c) => {
    code.push(c)
    return `${OPEN}${code.length - 1}${CLOSE}`
  })
  t = esc(t)
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => `<a href="${href}">${label}</a>`)
  t = t.replace(/&lt;(https?:\/\/[^&\s]+)&gt;/g, '<a href="$1">$1</a>')
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/(^|[\s(—])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  t = t.replace(new RegExp(`${OPEN}(\\d+)${CLOSE}`, 'g'),
    (_, i) => `<span class="tok">${esc(code[Number(i)])}</span>`)
  return t
}

const slug = (s) => s.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')

export function renderMarkdown(src) {
  const lines = src.split('\n')
  const out = []
  const buf = []
  let i = 0

  const paragraph = () => {
    if (!buf.length) return
    out.push(`<p class="doc-p">${inline(buf.join(' '))}</p>`)
    buf.length = 0
  }

  while (i < lines.length) {
    const line = lines[i]

    /* fenced code */
    if (/^```/.test(line)) {
      paragraph()
      const lang = line.slice(3).trim()
      const body = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++])
      i++
      out.push(`<pre class="code"${lang ? ` data-lang="${esc(lang)}"` : ''}>${esc(body.join('\n'))}</pre>`)
      continue
    }

    /* heading */
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      paragraph()
      const level = h[1].length
      const text = h[2].replace(/\s*#+\s*$/, '')
      const cls = level === 1 ? 'page-title' : 'section-title'
      out.push(`<h${level} class="${cls}" id="${slug(text)}">${inline(text)}</h${level}>`)
      i++
      continue
    }

    /* horizontal rule */
    if (/^---+\s*$/.test(line)) {
      paragraph()
      out.push('<hr class="doc-rule">')
      i++
      continue
    }

    /* pipe table */
    if (/^\|/.test(line) && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1] ?? '')) {
      paragraph()
      const cells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      const head = cells(line)
      i += 2
      const body = []
      while (i < lines.length && /^\|/.test(lines[i])) body.push(cells(lines[i++]))
      const th = head.map((c) => `<th>${inline(c)}</th>`).join('')
      const tr = body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('\n')
      /* An all-empty header row means the table is being used for layout; the
         guide has one of those. Emitting an empty <thead> would draw a rule
         across the top of it. */
      const showHead = head.some((c) => c !== '')
      out.push(`<table class="doc-table">${showHead ? `\n<thead><tr>${th}</tr></thead>` : ''}\n<tbody>\n${tr}\n</tbody></table>`)
      continue
    }

    /* list */
    if (/^(\s*)([-*]|\d+\.)\s+/.test(line)) {
      paragraph()
      const ordered = /^\s*\d+\./.test(line)
      const items = []
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/)
        if (m) { items.push([m[3]]); i++; continue }
        /* an indented continuation line belongs to the item above */
        if (items.length && /^\s+\S/.test(lines[i])) { items[items.length - 1].push(lines[i].trim()); i++; continue }
        break
      }
      const tag = ordered ? 'ol' : 'ul'
      out.push(`<${tag} class="doc-list">\n` +
        items.map((parts) => `  <li>${inline(parts.join(' '))}</li>`).join('\n') +
        `\n</${tag}>`)
      continue
    }

    if (line.trim() === '') { paragraph(); i++; continue }

    buf.push(line.trim())
    i++
  }
  paragraph()
  return out.join('\n\n')
}

export default renderMarkdown
