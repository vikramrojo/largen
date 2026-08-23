/* Validate a supplied component manifest.
 *
 * A manifest arrives from the network and then drives every answer the tools
 * give, so it is untrusted input in the ordinary sense. Two rules follow, and
 * both are requirements rather than caution:
 *
 *   1. A malformed manifest is an error, never a silent fall back to largen's
 *      reference set. Falling back would answer a question the caller did not
 *      ask, in terms of components their project does not have, and look like
 *      success.
 *   2. Nothing in here is ever used to build a filesystem path. Component names
 *      are resolved against a known list; see get_component_source.
 */

const NAME = /^[a-zA-Z][\w-]*$/

export class ManifestError extends Error {
  constructor(message) { super(message); this.name = 'ManifestError' }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** @returns {object} the manifest, normalised — throws ManifestError if unusable */
export function validateManifest(input) {
  if (!isPlainObject(input)) throw new ManifestError('manifest must be an object')

  if (!Array.isArray(input.components)) {
    throw new ManifestError('manifest.components must be an array')
  }
  if (input.components.length === 0) {
    throw new ManifestError('manifest.components is empty — nothing could be named in a spec')
  }
  if (input.components.length > 500) {
    throw new ManifestError(`manifest.components has ${input.components.length} entries; the limit is 500`)
  }

  if (!isPlainObject(input.axes)) throw new ManifestError('manifest.axes must be an object')
  const axes = {}
  for (const axis of ['tone', 'variant', 'size']) {
    const a = input.axes[axis]
    if (!isPlainObject(a)) throw new ManifestError(`manifest.axes.${axis} is missing`)
    if (!Array.isArray(a.values) || a.values.some((v) => typeof v !== 'string')) {
      throw new ManifestError(`manifest.axes.${axis}.values must be an array of strings`)
    }
    axes[axis] = { ...a, values: a.values }
  }

  const seen = new Set()
  const components = input.components.map((c, i) => {
    const where = `manifest.components[${i}]`
    if (!isPlainObject(c)) throw new ManifestError(`${where} must be an object`)
    if (typeof c.name !== 'string' || !NAME.test(c.name)) {
      throw new ManifestError(
        `${where}.name must match ${NAME} — got ${JSON.stringify(c.name)}`)
    }
    if (seen.has(c.name)) throw new ManifestError(`duplicate component ${JSON.stringify(c.name)}`)
    seen.add(c.name)

    if (c.element !== undefined && (typeof c.element !== 'string' || !/^[a-zA-Z][\w-]*$/.test(c.element))) {
      throw new ManifestError(`${where}.element must be an element name`)
    }
    if (c.contains !== undefined && (!Array.isArray(c.contains) || c.contains.some((x) => typeof x !== 'string'))) {
      throw new ManifestError(`${where}.contains must be an array of strings`)
    }
    if (c.slots !== undefined && (!Array.isArray(c.slots) || c.slots.some((x) => typeof x !== 'string'))) {
      throw new ManifestError(`${where}.slots must be an array of strings`)
    }
    return {
      name: c.name,
      for: typeof c.for === 'string' ? c.for : undefined,
      element: c.element ?? 'div',
      slots: c.slots ?? [],
      contains: c.contains,
    }
  })

  return { version: input.version ?? 'supplied', axes, components, notes: input.notes ?? [] }
}

export default validateManifest
