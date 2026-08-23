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
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { createValidator, manifest as referenceManifest } from '../../../genai/validate.js'
import { lintComponentCss, registeredSlots } from '../../../genai/lint.js'
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

export const get_contract = guard(({ section }) => ok(getSection(section)))

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

export const check_component_css = guard(({ css }) => {
  if (typeof css !== 'string' || !css.trim()) return fail('css must be a non-empty string')
  const { ok: clean, findings } = lintComponentCss(css, { slots: SLOTS })
  return ok({
    ok: clean,
    slots: SLOTS,
    findings,
    summary: clean
      ? 'No contract violations. Static checks cannot see rendering, though — ' +
        'render it in a browser in both themes before believing it.'
      : `${findings.filter((f) => f.severity === 'error').length} error(s), ` +
        `${findings.filter((f) => f.severity === 'warning').length} warning(s).`,
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
      required: ['css'],
      properties: { css: { type: 'string', description: 'The component CSS to check.' } },
    },
    handler: () => check_component_css,
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
