import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const at = (...p) => join(root, ...p)

import { readdirSync } from 'node:fs'

/* Directories a project keeps CSS in that nobody wants linted: dependencies,
   git internals, build output, and the preview scratch space. */
const SKIP = new Set(['node_modules', '.git', 'dist', '.previews'])

/**
 * Every stylesheet under a directory, for a command given no explicit paths.
 *
 * Bounded depth, because scanning a whole project tree to lint four files is a
 * poor trade. Shared by `verify` and `eval` rather than written once in each —
 * they had a copy apiece and the copies had already drifted in length before
 * anyone compared them.
 *
 * Filesystem work, so it lives here and not in genai/, which is deliberately
 * string-only: those modules are what the MCP server imports, and a server that
 * receives stylesheets over the wire has no directory to walk.
 */
export function discover(dir, depth = 0) {
  if (depth > 4) return []
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name) || entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...discover(full, depth + 1))
    else if (entry.name.endsWith('.css')) out.push(full)
  }
  return out
}
