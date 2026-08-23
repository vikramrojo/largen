/* Render a validated node tree to HTML.
 *
 * Deliberately free of node: imports so a browser can load this module directly.
 * That is what lets the playground run the same validator and the same renderer
 * the server runs: "hosted and local reach the same verdict" becomes a property
 * of there being one implementation, rather than something to test for.
 *
 * Escaping is belt-and-braces. Validation has already established that every
 * attribute value came from a fixed enumeration and that `text` is a string with
 * nowhere to hide markup — but text is the one field carrying arbitrary
 * characters, and a renderer that assumed its input was clean would be one
 * refactor away from being wrong.
 */

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img',
  'input', 'link', 'meta', 'source', 'track', 'wbr'])

export const escapeText = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const escapeAttr = (s) => escapeText(s)
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** @param {object} node  a node as returned by validateNode — NOT raw model output */
export function renderNode(node, indent = 0) {
  const pad = '  '.repeat(indent)
  const attrs = Object.entries(node.attrs ?? {})
    .map(([k, v]) => ` ${k}="${escapeAttr(v)}"`).join('')
  const tag = node.element ?? 'div'

  if (VOID.has(tag)) return `${pad}<${tag}${attrs}>`

  const kids = (node.children ?? []).map((c) => renderNode(c, indent + 1))
  const text = node.text === undefined ? '' : escapeText(node.text)

  /* Text-only and empty nodes stay on one line; anything with children opens
     out, so the returned HTML is readable when an agent inspects it directly. */
  if (!kids.length) return `${pad}<${tag}${attrs}>${text}</${tag}>`
  const lead = text ? `\n${pad}  ${text}` : ''
  return `${pad}<${tag}${attrs}>${lead}\n${kids.join('\n')}\n${pad}</${tag}>`
}

/** A complete standalone document, for the preview URL. */
export function renderDocument(html, { theme = 'light', css = '', title = 'largen preview', base = '' } = {}) {
  const safeTheme = theme === 'dark' ? 'dark' : 'light'
  return `<!doctype html>
<html lang="en" data-theme="${safeTheme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeText(title)}</title>
<link rel="stylesheet" href="${base}/largen.css">
<link rel="stylesheet" href="${base}/largen.components.css">
<link rel="stylesheet" href="${base}/theme-dark.css">
${css ? `<style>\n${css}\n</style>` : ''}
<style>
  body { padding: 2rem; }
</style>
</head>
<body>
${html}
</body>
</html>
`
}

export default renderNode
