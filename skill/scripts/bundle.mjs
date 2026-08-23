/* Inline @imports and squeeze whitespace. No dependencies.
 *
 * This replaces lightningcss, which did the same two jobs and cost 14 gzipped
 * bytes less on largen.css. That is the whole difference, because largen's
 * source is mostly long explanatory comments and gzip already handles repetition
 * better than any minifier handles prose.
 *
 * The dependency also injected `--lightningcss-light` / `--lightningcss-dark`
 * into every file carrying a `color-scheme` declaration — its machinery for
 * `light-dark()`, which largen never uses. Fourteen bytes was not worth a native
 * Rust toolchain on the deploy host of a library whose first claim is that it
 * needs no toolchain.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 *
 * No syntax lowering, no colour rewriting, no property reordering, no merging of
 * adjacent rules. largen's browser floor is set by the features it cannot live
 * without — @property, color-mix(), @layer, revert-layer — so there is nothing
 * below that floor to lower to, and every "clever" transform is a chance to
 * change meaning. Concatenation and whitespace are the safe operations.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const IMPORT = /@import\s+url\(\s*["']([^"']+)["']\s*\);?/g

/**
 * Strip comments, in one pass that also understands strings.
 *
 * Both must be recognised by the same loop, in source order, because each can
 * contain the other's delimiters. Handling strings first and comments second —
 * the obvious decomposition — fails immediately on this codebase: largen's
 * comments are English prose full of apostrophes ("a component's background",
 * "every element's UA defaults"), and a string-scanner run first reads the
 * apostrophe in `component's` as an opening quote, swallows everything to the
 * next one, and leaves the comment in place. The output was twice the expected
 * size, which is at least a loud failure.
 */
export function stripComments(css) {
  let out = ''
  let i = 0
  while (i < css.length) {
    const ch = css[i]

    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      /* An unterminated comment means the rest of the file is comment. */
      if (end < 0) break
      i = end + 2
      continue
    }

    if (ch === '"' || ch === "'") {
      let j = i + 1
      while (j < css.length && css[j] !== ch) {
        if (css[j] === '\\') j++
        j++
      }
      out += css.slice(i, Math.min(j + 1, css.length))
      i = j + 1
      continue
    }

    out += ch
    i++
  }
  return out
}

/**
 * Collapse whitespace, conservatively.
 *
 * Runs of whitespace become one space, and whitespace is trimmed only around
 * `{`, `}`, `;` and `,`.
 *
 * It is NOT trimmed around `:` or any combinator, and that restriction is the
 * whole reason this function is worth reading. Trimming around `:` turns
 *
 *     .prose :is(h1,h2)   into   .prose:is(h1,h2)
 *
 * — a descendant combinator becoming a compound selector, so the rule stops
 * matching descendants and starts matching the element itself. components/prose.css
 * contains that exact pattern. It is silent, it looks like a smaller file, and
 * nothing but a rendered page would catch it.
 *
 * Safe to run only after stripComments, which leaves quotes balanced.
 */
export function collapse(css) {
  let out = ''
  let i = 0
  while (i < css.length) {
    const ch = css[i]
    if (ch === '"' || ch === "'") {
      let j = i + 1
      while (j < css.length && css[j] !== ch) {
        if (css[j] === '\\') j++
        j++
      }
      out += css.slice(i, Math.min(j + 1, css.length))
      i = j + 1
      continue
    }
    let j = i
    while (j < css.length && css[j] !== '"' && css[j] !== "'") j++
    out += css.slice(i, j)
      .replace(/\s+/g, ' ')
      .replace(/\s*([{};,])\s*/g, '$1')
      .replace(/;\}/g, '}')
    i = j
  }
  return out.trim()
}

/**
 * Inline every `@import url("…")`, depth-first, resolving each path against the
 * file that imported it.
 *
 * Resolved paths are remembered, so a stylesheet imported twice is emitted once
 * and an import cycle terminates instead of recursing forever. That matters
 * here: sites/example/index.css and components/index.css both reach
 * components/prose.css.
 */
export function inlineImports(entry, seen = new Set()) {
  const file = resolve(entry)
  if (seen.has(file)) return ''
  seen.add(file)

  const css = readFileSync(file, 'utf8')
  const here = dirname(file)

  return css.replace(IMPORT, (_, spec) => inlineImports(resolve(here, spec), seen))
}

/**
 * @param {string} entry   path to the entry stylesheet
 * @param {string} [banner] a `/*! … *​/` comment to keep at the top
 * @returns {string} one stylesheet
 */
export function bundle(entry, banner) {
  const body = collapse(stripComments(inlineImports(entry)))
  return banner ? `${banner}\n${body}\n` : `${body}\n`
}

export default bundle
