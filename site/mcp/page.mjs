/* The page shell every site page shares.
 *
 * Plain string templating rather than a template engine, because a template
 * engine is a build step wearing a hat and the site's argument is that it does
 * not need one. Pages are written out as static HTML and served straight off
 * disk; regenerating them is the same optional dev-time convenience as
 * `largen build`, not something the server does on the way to a response.
 */

export const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/* Markdown-ish inline conversion, limited on purpose to the two forms the
   contract prose actually uses: `code` and *emphasis*. Anything richer would be
   a Markdown renderer, which is a dependency the site does not want.

   Code spans are lifted out before emphasis is applied, and only put back at the
   end. Doing emphasis first — or over the already-built spans — lets an asterisk
   inside a code span pair with a later one, which is how the contract's own
   sentence about the paint rule using a bare `*` rather than `:where(*)` lost
   both asterisks and italicised the text between them. Technical prose is full
   of punctuation that looks like markup. */
const OPEN = '\u0011'
const CLOSE = '\u0012'

export function inline(text) {
  const code = []
  let t = String(text).replace(/`([^`]+)`/g, (_, c) => {
    code.push(c)
    return `${OPEN}${code.length - 1}${CLOSE}`
  })
  t = esc(t)
  t = t.replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
  return t.replace(new RegExp(`${OPEN}(\\d+)${CLOSE}`, 'g'),
    (_, i) => `<span class="tok">${esc(code[Number(i)])}</span>`)
}

const NAV = [
  ['/docs/contract.html', 'contract'],
  ['/docs/axes.html', 'axes'],
  ['/docs/authoring.html', 'authoring'],
  ['/docs/components.html', 'components'],
  ['/docs/mcp.html', 'mcp'],
  ['/docs/migrating.html', 'migrating'],
  ['/play', 'play'],
  ['/demo/', 'demos'],
]

export function page({ title, description, current, body, version }) {
  const nav = NAV.map(([href, label]) =>
    `<a class="nav-link" href="${href}"${current === label ? ' aria-current="page"' : ''}>${label}</a>`
  ).join('\n        ')

  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="stylesheet" href="/largen.css">
<link rel="stylesheet" href="/largen.components.css">
<link rel="stylesheet" href="/theme-dark.css">
<link rel="stylesheet" href="/site.css">
</head>
<body>

<header class="site-header">
  <a class="wordmark" href="/">largen</a>
  <nav class="cluster" style="--gap:1rem">
        ${nav}
    <label class="theme-toggle">
      <input type="checkbox" hidden onchange="
        document.documentElement.dataset.theme = this.checked ? 'dark' : 'light';
        try { localStorage.setItem('largen-theme', document.documentElement.dataset.theme) } catch (e) {}
      "><span data-swap="off">☀</span><span data-swap="on">☾</span>
    </label>
  </nav>
</header>

<main class="page">
${body}
</main>

<footer class="site-footer">
  <span>largen ${esc(version)} — a property algebra for CSS. MIT.</span>
  <span class="cluster" style="--gap:.75rem">
    <a class="nav-link" href="/llms.txt">llms.txt</a>
    <a class="nav-link" href="/llms-compact.txt">llms-compact.txt</a>
    <a class="nav-link" href="/largen.css">largen.css</a>
    <a class="nav-link" href="/health">health</a>
  </span>
</footer>

<script>
  /* Decide which theme is on. Not a component concern — largen carries the theme
     itself; this only picks one. ?theme= wins over the stored preference so a
     link can pin a theme, which is also what makes both themes screenshottable
     in verification. */
  (function () {
    var t = null
    try { t = new URLSearchParams(location.search).get('theme') } catch (e) {}
    if (t !== 'dark' && t !== 'light') {
      try { t = localStorage.getItem('largen-theme') } catch (e) { t = null }
    }
    if (t !== 'dark' && t !== 'light') return
    document.documentElement.dataset.theme = t
    var box = document.querySelector('.theme-toggle input')
    if (box) box.checked = t === 'dark'
  })()
</script>
</body>
</html>
`
}

export default page
