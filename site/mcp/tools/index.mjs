/* The six tools.
 *
 * Each is a pure function over its arguments. The server holds no per-client
 * state, so a restart between two identical calls returns the same answer —
 * previews addressed by id are the single deliberate exception.
 *
 * Every tool that reasons about components takes an optional `components`
 * manifest. That is the whole shape of this server: largen's premise is that
 * projects author their own components, so a catalog held here could only ever
 * describe largen's reference set — useless in the projects that matter. The
 * calling agent has filesystem access; it reads the project's CSS with
 * `largen manifest` and passes the result in.
 */
import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { createValidator, manifest as referenceManifest } from '../../../genai/validate.js'
import { lintComponentCss, registeredSlots } from '../../../genai/lint.js'
import { checkLayerOrder } from '../../../genai/layers.js'
import { getSection, SECTIONS } from '../contract.mjs'
import { validateManifest, ManifestError } from '../manifest-schema.mjs'
import { renderNode, renderDocument } from '../render.mjs'
import { SOURCE } from '../source.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const SLOTS = registeredSlots(read('src/properties.css'))

/* --- Shared helpers ------------------------------------------------------- */

/** Resolve the manifest a call should answer in terms of.
 *  A malformed one is an error; it is never quietly replaced with the reference
 *  set, because that would answer confidently in the wrong vocabulary. */
function resolveManifest(supplied) {
  if (supplied === undefined || supplied === null) {
    return { manifest: referenceManifest, source: 'largen reference components' }
  }
  return { manifest: validateManifest(supplied), source: 'supplied manifest' }
}

const ok = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] })
const fail = (message, extra = {}) => ({
  isError: true,
  content: [{ type: 'text', text: JSON.stringify({ ok: false, error: message, ...extra }, null, 2) }],
})

const guard = (fn) => (args) => {
  try { return fn(args ?? {}) }
  catch (e) {
    if (e instanceof ManifestError) return fail(`invalid manifest: ${e.message}`)
    return fail(e.message)
  }
}

/* --- 1. get_contract ------------------------------------------------------ */

/* Re-read when dist/build.json changes, like the server does. A deploy rebuilds
   and restarts, so a startup read would nearly always be enough — and "nearly
   always" is how a tool reports one build's identity for another build's bytes. */
let buildCache = { mtime: 0, data: null }
function buildInfo() {
  const file = join(root, 'dist', 'build.json')
  try {
    const { mtimeMs } = statSync(file)
    if (mtimeMs !== buildCache.mtime) {
      buildCache = { mtime: mtimeMs, data: JSON.parse(readFileSync(file, 'utf8')) }
    }
  } catch { buildCache = { mtime: 0, data: null } }
  return buildCache.data
}

export const get_contract = guard(({ section }) => {
  const info = buildInfo()
  /* The version alone does not identify a build — the unversioned path and a
     frozen /v/<version>/ path have shared a version string while serving
     different bytes. Anyone checking a vendored contract for drift needs this. */
  return ok({ build: info?.build ?? null, ...getSection(section) })
})

export const get_build = guard(() => {
  const info = buildInfo()
  if (!info) return fail('no build manifest — run `largen build`')
  return ok({
    version: info.version,
    build: info.build,
    files: info.files,
    note: '`sha256` and `integrity` are of the served bytes, banner included — what ' +
      '`curl | shasum -a 256` reproduces and what to record when vendoring. `build` ' +
      'is the hash of the bundle before the banner was added; it names the build but ' +
      'is not the file digest. Unversioned paths are not immutable: pin by sha256, ' +
      'by integrity, or use a /v/<version>/ path.',
  })
})

/* --- 2. list_components --------------------------------------------------- */

export const list_components = guard(({ components }) => {
  const { manifest, source } = resolveManifest(components)
  return ok({
    source,
    count: manifest.components.length,
    axes: Object.fromEntries(Object.entries(manifest.axes).map(([k, a]) => [k, a.values])),
    components: manifest.components.map((c) => ({
      name: c.name,
      description: c.for ?? null,
      element: c.element ?? 'div',
      slots: c.slots ?? [],
      contains: c.contains ?? null,
      sourceAvailable: SOURCE.has(c.name),
    })),
  })
})

/* --- 3. get_component_source ---------------------------------------------- */

export const get_component_source = guard(({ name }) => {
  if (typeof name !== 'string') return fail('name must be a string')
  const entry = SOURCE.get(name)
  if (!entry) {
    return fail(`no reference component named ${JSON.stringify(name)}`, {
      hint: 'get_component_source only serves largen\'s reference components, for copying ' +
        'into a project. Your own components live in your own stylesheet.',
      available: [...SOURCE.keys()].sort(),
    })
  }
  return ok({
    name: entry.name,
    file: entry.file,
    css: entry.css,
    note: 'Copy this into your own stylesheet inside `@layer largen.components`. ' +
      'It is yours to edit — largen ships an algebra, not a dependency.',
  })
})

/* --- 4. validate_spec ------------------------------------------------------ */

export const validate_spec = guard(({ spec, components }) => {
  const { manifest, source } = resolveManifest(components)
  const { safeValidateNode } = createValidator(manifest)
  const result = safeValidateNode(spec)
  if (!result.ok) return ok({ ok: false, source, errors: [result.error] })
  return ok({ ok: true, source, normalised: result.value })
})

/* --- 5. check_component_css ------------------------------------------------ */

const lintOne = (css) => {
  const { ok: clean, findings } = lintComponentCss(css, { slots: SLOTS })
  return {
    ok: clean,
    findings,
    summary: clean
      ? 'No contract violations. Static checks cannot see rendering, though — ' +
        'render it in a browser in both themes before believing it.'
      : `${findings.filter((f) => f.severity === 'error').length} error(s), ` +
        `${findings.filter((f) => f.severity === 'warning').length} warning(s).`,
  }
}

/* One stylesheet or many. The array form exists because linting a project meant
   one call per file — 27 of one reporter's 34 calls were that. The single-string
   form is kept rather than replaced: the server has callers, and one of them is a
   migration in progress. */
export const check_component_css = guard(({ css, files }) => {
  if (files !== undefined) {
    if (!Array.isArray(files) || !files.length) return fail('files must be a non-empty array')
    const results = []
    for (const [i, f] of files.entries()) {
      if (!f || typeof f.name !== 'string' || typeof f.css !== 'string') {
        return fail(`files[${i}] must be { name: string, css: string }`)
      }
      results.push({ name: f.name, ...lintOne(f.css) })
    }
    const bad = results.filter((r) => !r.ok)
    return ok({
      ok: bad.length === 0,
      slots: SLOTS,
      checked: results.length,
      results,
      summary: bad.length
        ? `${bad.length} of ${results.length} stylesheet(s) have errors: ${bad.map((r) => r.name).join(', ')}`
        : `${results.length} stylesheet(s) clean. Static checks cannot see rendering.`,
    })
  }
  if (typeof css !== 'string' || !css.trim()) {
    return fail('pass `css` as a non-empty string, or `files` as [{ name, css }]')
  }
  return ok({ slots: SLOTS, ...lintOne(css) })
})

/* --- property -> slot ------------------------------------------------------
 *
 * Parsed from the paint rule, which is the only authoritative statement of which
 * property each slot drives. Deriving it means adding a slot needs no edit here —
 * and the question this answers ("is line-height a slot?") is one a reporter got
 * wrong four times in a row by having nowhere to ask it. */
const PROPERTY_SLOT = (() => {
  const map = new Map()
  const paint = read('src/paint.css').replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of paint.matchAll(/([a-z-]+)\s*:\s*var\(\s*(--[\w-]+)\s*,\s*revert-layer\s*\)/g)) {
    map.set(m[1], m[2])
  }
  return map
})()

export const lookup_property = guard(({ property }) => {
  if (typeof property !== 'string' || !property.trim()) return fail('property must be a string')
  const name = property.trim().replace(/^--/, '').toLowerCase()
  const slot = PROPERTY_SLOT.get(name)
  if (slot) {
    return ok({
      property: name, isSlot: true, slot,
      note: `Set \`${slot}\` in the component. The universal paint rule reads it, ` +
        'so tone, variant, size and state all continue to apply.',
    })
  }
  return ok({
    property: name, isSlot: false, slot: null,
    note: 'Not driven by a slot — the paint rule does not consult it. Write it as a ' +
      'plain declaration inside your component rule. That is allowed and normal; a ' +
      'component is slots plus whatever shape it needs.',
    slots: Object.fromEntries(PROPERTY_SLOT),
  })
})

/* --- check_layer_order -----------------------------------------------------
 *
 * The one check here that reads more than one file at a time, and the only kind
 * that could have caught the two most expensive bugs reported from the field.
 * Both were cross-file: a linter reading one stylesheet structurally cannot see
 * that a layer it believes is losing actually sorts later. */
export const check_layer_order = guard(({ files }) => {
  if (!Array.isArray(files) || !files.length) {
    return fail('files must be a non-empty array of { name, css }, in document load order')
  }
  for (const [i, f] of files.entries()) {
    if (!f || typeof f.name !== 'string' || typeof f.css !== 'string') {
      return fail(`files[${i}] must be { name: string, css: string }`)
    }
  }
  const result = checkLayerOrder(files)
  return ok({
    ...result,
    note: result.ok
      ? 'The declared order is achievable. Note this reads text: it assumes the ' +
        'files are given in the order the document loads them, and cannot check that.'
      : 'Layer order beats specificity, so no selector weight recovers these. Fix ' +
        'the order rather than the selectors.',
  })
})

/* --- 6. render_spec -------------------------------------------------------- */

export function makeRenderSpec({ previews, baseUrl }) {
  return guard(({ spec, components, theme = 'light', css = '' }) => {
    const { manifest, source } = resolveManifest(components)
    const { safeValidateNode } = createValidator(manifest)
    const result = safeValidateNode(spec)

    /* An invalid spec gets errors and no URL. A preview of partially-valid
       output would be a picture of something that is not allowed to exist. */
    if (!result.ok) return ok({ ok: false, source, errors: [result.error], url: null })

    if (typeof css !== 'string') return fail('css must be a string')
    if (css.length > 200_000) return fail('css is larger than 200kb')

    const html = renderNode(result.value)
    const document = renderDocument(html, { theme, css })
    const id = previews.put({ html, theme, css, document })

    return ok({
      ok: true,
      source,
      html,
      url: `${baseUrl}/play/${id}`,
      theme,
      note: 'A 200 from that URL is not evidence that anything rendered. Open it, ' +
        'or screenshot it.',
    })
  })
}

/* --- Registration ---------------------------------------------------------- */

const componentsParam = {
  type: 'object',
  description:
    "Optional. This project's component manifest, as produced by `largen manifest " +
    "<css...>`. Supply it and the tool answers in terms of your components; omit it " +
    "and it falls back to largen's reference set. A malformed manifest is an error, " +
    'not a silent fallback.',
}

export const TOOL_DEFINITIONS = [
  {
    name: 'get_contract',
    title: 'Get the largen authoring contract',
    description:
      'The slots, the axes and their permitted values, the layer rule, the authoring ' +
      'rules and the known failure modes. Call this before authoring a component.',
    inputSchema: {
      type: 'object',
      properties: {
        section: { type: 'string', enum: SECTIONS, description: 'Return only one section.' },
      },
    },
    handler: () => get_contract,
  },
  {
    name: 'list_components',
    title: 'List the components a spec may name',
    description:
      'Every component permitted in a spec, with its description, element, slots and ' +
      'permitted children.',
    inputSchema: { type: 'object', properties: { components: componentsParam } },
    handler: () => list_components,
  },
  {
    name: 'get_component_source',
    title: 'Get the CSS of a reference component',
    description:
      "The CSS source of one of largen's reference components, for copying into a " +
      'project. largen ships an algebra rather than a dependency, so this is copy-in.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: { name: { type: 'string', description: 'A reference component name.' } },
    },
    handler: () => get_component_source,
  },
  {
    name: 'validate_spec',
    title: 'Validate a UI spec',
    description:
      'Check a model-emitted node tree against the component allowlist. Rejects unknown ' +
      'components, unknown axis values, and any injected property (`style`, `onclick`, ' +
      '`className`, `dangerouslySetInnerHTML`) rather than dropping it.',
    inputSchema: {
      type: 'object',
      required: ['spec'],
      properties: {
        spec: { type: 'object', description: 'The node tree: {component, tone?, variant?, size?, text?, children?}' },
        components: componentsParam,
      },
    },
    handler: () => validate_spec,
  },
  {
    name: 'check_component_css',
    title: 'Lint authored component CSS',
    description:
      'Check CSS you just wrote against the authoring contract: layer membership, ' +
      'colour literals, reaching past the tone axis, and unregistered slots. The layer ' +
      'check matters most — an unlayered component breaks `data-variant` silently.',
    inputSchema: {
      type: 'object',
      properties: {
        css: { type: 'string', description: 'One stylesheet to check.' },
        files: {
          type: 'array',
          description: 'Several stylesheets at once. Findings come back per file, ' +
            'so linting a project is one call rather than one call per file.',
          items: {
            type: 'object',
            required: ['name', 'css'],
            properties: {
              name: { type: 'string', description: 'How to refer to this stylesheet in findings.' },
              css: { type: 'string' },
            },
          },
        },
      },
    },
    handler: () => check_component_css,
  },
  {
    name: 'lookup_property',
    title: 'Ask whether a CSS property is driven by a slot',
    description:
      'Answers "is this property a slot, and which one?" — derived from the paint ' +
      'rule, so it follows the library rather than a list kept beside it. A property ' +
      'that is not a slot is written as a plain declaration in the component.',
    inputSchema: {
      type: 'object',
      required: ['property'],
      properties: { property: { type: 'string', description: 'A CSS property name, e.g. line-height.' } },
    },
    handler: () => lookup_property,
  },
  {
    name: 'check_layer_order',
    title: 'Resolve cascade layer order across stylesheets',
    description:
      'Given several stylesheets in load order, resolves where each @layer actually ' +
      'sorts and reports where that differs from the order declared. Catches the two ' +
      'failures a single-file linter cannot see: sublayers of one parent that cannot ' +
      'straddle a third layer, and a framework base layer sorting after largen.',
    inputSchema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          description: 'Stylesheets in the order the document loads them.',
          items: {
            type: 'object',
            required: ['name', 'css'],
            properties: { name: { type: 'string' }, css: { type: 'string' } },
          },
        },
      },
    },
    handler: () => check_layer_order,
  },
  {
    name: 'get_build',
    title: 'Get the identity and checksums of the served stylesheets',
    description:
      'Version, build id, and per-file byte length, sha256 and SRI integrity string. ' +
      'Use it to check a vendored copy for drift — the version string alone does not ' +
      'identify a build.',
    inputSchema: { type: 'object', properties: {} },
    handler: () => get_build,
  },
  {
    name: 'render_spec',
    title: 'Render a spec to HTML and a preview URL',
    description:
      'Validate a spec, render it, and return the HTML inline plus a URL showing the ' +
      'same rendering. Supply `css` to include your own component definitions.',
    inputSchema: {
      type: 'object',
      required: ['spec'],
      properties: {
        spec: { type: 'object', description: 'The node tree to render.' },
        components: componentsParam,
        theme: { type: 'string', enum: ['light', 'dark'], description: 'Defaults to light.' },
        css: { type: 'string', description: "This project's component CSS, included in the preview." },
      },
    },
    handler: (ctx) => makeRenderSpec(ctx),
  },
]

export { SOURCE, SLOTS }
