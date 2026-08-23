/* largen — model-output validation.
 *
 * Zero dependencies. Takes whatever a model emitted and returns a plain
 * attribute bag, or throws.
 *
 * The safety property is structural rather than defensive: there is no field in
 * which a colour, a class, a style or an event handler could be expressed, so
 * there is nothing to sanitise. Unknown keys are rejected rather than dropped —
 * dropping would already be safe, but a model emitting `style` or `onclick` is a
 * signal, and silently discarding it hides that.
 */
import defaultManifest from './manifest.js'

const KEYS = new Set(['component', 'tone', 'variant', 'size', 'text', 'children'])
const MAX_DEPTH = 12
const MAX_CHILDREN = 64

export class LargenValidationError extends Error {
  constructor(message, path) {
    super(path ? `${message} (at ${path})` : message)
    this.name = 'LargenValidationError'
    this.path = path
  }
}

/* A project supplies its own components, so validation has to be able to run
 * against a manifest other than the one baked in here — that is what the MCP
 * server's optional `components` parameter means. Rather than let the server
 * reimplement these checks (which would drift, and a spec that passed locally
 * would fail hosted), the rules are parameterised over a manifest and the
 * module-level exports are simply the instance bound to largen's own.
 */
export function createValidator(manifest = defaultManifest) {
  const BY_NAME = new Map(manifest.components.map((c) => [c.name, c]))
  const TONES = new Set(manifest.axes.tone.values)
  const VARIANTS = new Set(manifest.axes.variant.values)
  const SIZES = new Set(manifest.axes.size.values)

  const validateNode = (node, { path = '$', depth = 0 } = {}) =>
    check(node, { path, depth, BY_NAME, TONES, VARIANTS, SIZES })

  const safeValidateNode = (node) => {
    try { return { ok: true, value: validateNode(node) } }
    catch (e) {
      if (e instanceof LargenValidationError) return { ok: false, error: e.message }
      throw e
    }
  }

  return { validateNode, safeValidateNode, manifest }
}

function check(node, { path, depth, BY_NAME, TONES, VARIANTS, SIZES }) {
  if (depth > MAX_DEPTH) throw new LargenValidationError(`nesting deeper than ${MAX_DEPTH}`, path)
  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    throw new LargenValidationError('node must be an object', path)
  }
  const spec = BY_NAME.get(node.component)
  if (!spec) throw new LargenValidationError(`unknown component ${JSON.stringify(node.component)}`, path)

  for (const key of Object.keys(node)) {
    if (!KEYS.has(key)) throw new LargenValidationError(`unexpected property ${JSON.stringify(key)}`, path)
  }

  const attrs = { class: node.component }
  const axis = (key, set, attr) => {
    if (node[key] === undefined) return
    if (!set.has(node[key])) {
      throw new LargenValidationError(`unknown ${key} ${JSON.stringify(node[key])}`, path)
    }
    attrs[attr] = node[key]
  }
  axis('tone', TONES, 'data-tone')
  axis('variant', VARIANTS, 'data-variant')
  axis('size', SIZES, 'data-size')

  if (node.text !== undefined && typeof node.text !== 'string') {
    throw new LargenValidationError('text must be a string', path)
  }

  let children = []
  if (node.children !== undefined) {
    if (!Array.isArray(node.children)) throw new LargenValidationError('children must be an array', path)
    if (node.children.length > MAX_CHILDREN) {
      throw new LargenValidationError(`more than ${MAX_CHILDREN} children`, path)
    }
    children = node.children.map((child, i) => {
      const p = `${path}.children[${i}]`
      const out = check(child, { path: p, depth: depth + 1, BY_NAME, TONES, VARIANTS, SIZES })
      const allowed = spec.contains
      if (allowed && !allowed.includes('*') && !allowed.includes(out.component)) {
        throw new LargenValidationError(
          `${JSON.stringify(out.component)} is not permitted inside ${JSON.stringify(node.component)}`, p)
      }
      return out
    })
  }

  return { component: node.component, element: spec.element, attrs, text: node.text, children }
}

/* The default instance: largen's own reference components. Existing callers see
   no change — these are the same two functions with the same signatures. */
const base = createValidator(defaultManifest)
export const validateNode = base.validateNode
export const safeValidateNode = base.safeValidateNode

export { defaultManifest as manifest }
export default validateNode
