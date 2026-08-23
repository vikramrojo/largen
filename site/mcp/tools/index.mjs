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
import { lintComponentCss, registeredSlots, classifySheet } from '../../../genai/lint.js'
import { checkLayerOrder, orderFromImports } from '../../../genai/layers.js'
import { buildProbe } from '../../../genai/probe.js'
import { resolveProperty } from '../../../genai/cascade.js'
import { explainSlot, paintMap } from '../../../genai/slots.js'
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
      /* Classify before linting. You pass a file, you tend to pass the
         directory, and the directory holds the theme — one reporter did exactly
         that and got 130 findings, every token flagged as a colour literal in an
         undeclared component. The content rules are rules about components;
         judging a theme by them produces confident nonsense. `largen verify` has
         always skipped these during discovery and this form did not, which made
         two surfaces of one linter disagree. Reported, not silently dropped:
         a caller who meant to lint that file needs to see why it was not. */
      const { kind, why } = classifySheet(f.css, SLOTS)
      if (kind !== 'component') {
        results.push({ name: f.name, kind, ok: true, findings: [], skipped: why })
        continue
      }
      results.push({ name: f.name, kind, ...lintOne(f.css) })
    }
    const linted = results.filter((r) => r.kind === 'component')
    const skipped = results.filter((r) => r.kind !== 'component')
    const bad = results.filter((r) => !r.ok)
    return ok({
      ok: bad.length === 0,
      slots: SLOTS,
      checked: linted.length,
      skipped: skipped.length,
      results,
      summary: (bad.length
        ? `${bad.length} of ${linted.length} component stylesheet(s) have errors: ${bad.map((r) => r.name).join(', ')}`
        : `${linted.length} component stylesheet(s) clean. Static checks cannot see rendering.`) +
        (skipped.length
          ? ` ${skipped.length} file(s) declare no components and were not linted: ` +
            `${skipped.map((r) => r.name).join(', ')}.`
          : ''),
    })
  }
  if (typeof css !== 'string' || !css.trim()) {
    return fail('pass `css` as a non-empty string, or `files` as [{ name, css }]')
  }
  return ok({ slots: SLOTS, ...lintOne(css) })
})

/* --- resolve_cascade and explain_slot ---------------------------------------
 *
 * The pair that answers "which rule decided this?" with no browser at all. Both
 * take an ancestor chain rather than a document: a list of {tag, classes, attrs}
 * with no children, no text and no scripts. There is nothing to parse as markup
 * and nothing to execute, which is what makes them safe on a public endpoint
 * where a rendering engine would not be.
 *
 * Both can answer "undecidable", and that answer is load-bearing. A chain has no
 * siblings and no interaction state, so :hover, :last-child, :nth-* and the
 * sibling combinators cannot be evaluated against it. Reporting those explicitly
 * rather than dropping them is the difference between a diagnostic instrument
 * and a confident one. */

const checkFiles = (files) => {
  if (!Array.isArray(files) || !files.length) return 'files must be a non-empty array of { name, css }'
  for (const [i, f] of files.entries()) {
    if (!f || typeof f.name !== 'string' || typeof f.css !== 'string') return `files[${i}] must be { name: string, css: string }`
  }
  return null
}

const checkPath = (path) => {
  if (!Array.isArray(path) || !path.length) return 'path must be a non-empty ancestor chain, outermost first'
  for (const [i, n] of path.entries()) {
    if (!n || typeof n !== 'object') return `path[${i}] must be { tag, classes?, attrs?, id? }`
    if (n.tag !== undefined && typeof n.tag !== 'string') return `path[${i}].tag must be a string`
    if (n.classes !== undefined && !Array.isArray(n.classes)) return `path[${i}].classes must be an array of strings`
  }
  return null
}

const undecidableNote = (list) => list.length
  ? `${list.length} rule(s) could not be decided from an ancestor chain — they depend on ` +
    'siblings, child position or interaction state. They are listed under `undecidable`, ' +
    'not dropped: any one of them could be the rule that actually wins. Use emit_probe to settle it.'
  : null

export const resolve_cascade = guard(({ files, entry, path, property, viewport }) => {
  const bad = checkFiles(files) || checkPath(path)
  if (bad) return fail(bad)
  if (typeof property !== 'string' || !property.trim()) return fail('property must be a CSS property name, such as `--weight` or `font-weight`')
  try {
    const r = resolveProperty({ files, entry, path, property })
    return ok({
      ...r,
      viewport: viewport ?? null,
      notes: [
        undecidableNote(r.undecidable),
        r.conditional
          ? `${r.conditional} matching declaration(s) sit inside @media or @supports. Those conditions ` +
            'are reported on each declaration and are NOT evaluated — the winner shown assumes they all apply.'
          : null,
        r.winner && /\b(var|calc|color-mix|clamp|min|max)\(/.test(r.winner.value)
          ? 'The winning value is an expression and is returned as written. Reducing it is a second ' +
            'engine\'s worth of work; emit_probe will give you the computed result.'
          : null,
        !r.winner && !r.undecidable.length
          ? `No rule sets \`${property}\` on this element. If it is a custom property registered ` +
            '`inherits: false` — every largen slot is — then nothing arrives by inheritance either, ' +
            'and it is guaranteed-invalid here.'
          : null,
      ].filter(Boolean),
    })
  } catch (error) {
    return fail(error.message)
  }
})

export const explain_slot = guard(({ files, entry, path, slot }) => {
  const bad = checkFiles(files) || checkPath(path)
  if (bad) return fail(bad)
  if (typeof slot !== 'string' || !slot.startsWith('--')) return fail('slot must be a custom property name such as `--fg`')
  if (!SLOTS.includes(slot)) {
    return fail(`\`${slot}\` is not a registered slot`, { slots: SLOTS })
  }
  try {
    const r = explainSlot({ files, entry, path, slot, paintCss: PAINT_CSS })
    return ok({ ...r, note: undecidableNote(r.undecidable) })
  } catch (error) {
    return fail(error.message)
  }
})

/* --- emit_probe -------------------------------------------------------------
 *
 * The one tool here that answers a question needing a rendering engine, and it
 * answers it by not having one. The server builds a document and never opens
 * it: no parsing, no evaluation, no execution, nothing to sandbox. The caller
 * serves it from their own build and their own browser does the work.
 *
 * That inversion is the whole design. A hosted endpoint taking arbitrary markup
 * is remote code execution; taking a validated spec instead removes the use
 * case, because the markup a migration needs to ask about already exists. Moving
 * the execution rather than restricting the input keeps both. */
export const emit_probe = guard((args = {}) => {
  const { kind = 'computed', pages, html, selectors, properties, steps, assertions, themes, viewport, timeout } = args
  try {
    const document = buildProbe({
      kind, pages, html, selectors, properties, steps, assertions, themes, viewport, timeout,
    })
    return ok({
      kind,
      document,
      bytes: document.length,
      usage:
        'Save this as an .html file inside the build you want to measure, serve that ' +
        'build, and open the file. The frames it opens must be same-origin, which they ' +
        'are if you serve it alongside the pages.',
      reading:
        'Results appear as a table, on `window.__largenProbeResults`, and as JSON text ' +
        'in the hidden `#json` element — the last so a headless driver can read them ' +
        'with --dump-dom and no script evaluation.',
      caveats: [
        'CSS :hover cannot be synthesised. Dispatching events does not set it; use a ' +
          'driver that moves a real pointer, or assert on a class the code sets instead.',
        'A selector that matches nothing is reported as a failure, not skipped. A ' +
          'harness whose targets never rendered passes everything.',
      ],
    })
  } catch (error) {
    return fail(error.message)
  }
})

/* --- property -> slot ------------------------------------------------------
 *
 * Parsed from the paint rule, which is the only authoritative statement of which
 * property each slot drives. Deriving it means adding a slot needs no edit here —
 * and the question this answers ("is line-height a slot?") is one a reporter got
 * wrong four times in a row by having nowhere to ask it. */
const PAINT_CSS = read('src/paint.css')
/* One parser of the paint rule, in genai/slots.js, shared with explain_slot.
   A second copy here is how check_component_css and `largen verify` came to
   disagree about what a component file is. */
const PROPERTY_SLOT = paintMap(PAINT_CSS).propertyToSlot

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
export const check_layer_order = guard(({ files, entry }) => {
  if (!Array.isArray(files) || !files.length) {
    return fail('files must be a non-empty array of { name, css }, in document load order')
  }
  for (const [i, f] of files.entries()) {
    if (!f || typeof f.name !== 'string' || typeof f.css !== 'string') {
      return fail(`files[${i}] must be { name: string, css: string }`)
    }
  }
  /* Without `entry` this believes the order it was given, which is the one place
     the answer can be silently wrong. With it, the order is derived from the
     entry's @import graph and the assumption disappears. */
  let ordered = files
  let derived = null
  if (entry !== undefined) {
    if (typeof entry !== 'string' || !entry.trim()) return fail('entry must be the name of one of the files')
    try {
      const walked = orderFromImports(files, entry)
      ordered = walked.order
      derived = {
        from: entry,
        order: walked.order.map((f) => f.name),
        unresolved: walked.unresolved,
        layered: walked.layered,
        unreached: walked.unreached,
      }
    } catch (error) {
      return fail(error.message)
    }
  }

  const result = checkLayerOrder(ordered)

  /* A derivation with holes is worse than no derivation if the holes are not
     said out loud: an unresolved @import is a stylesheet whose layers are absent
     from this answer, and the caller reads their absence as "no layers there". */
  const caveats = []
  if (derived) {
    if (derived.unresolved.length) {
      caveats.push(
        `${derived.unresolved.length} @import(s) could not be resolved within the files provided ` +
        `(${derived.unresolved.map((u) => u.spec).join(', ')}). Any layer they declare is missing ` +
        'from this answer — pass those files too.')
    }
    if (derived.layered.length) {
      caveats.push(
        `${derived.layered.length} @import(s) carry a layer() condition ` +
        `(${derived.layered.map((l) => `${l.spec} ${l.condition}`).join('; ')}). That wraps the ` +
        'imported sheet in a layer it never mentions, so its layers are attributed to the file, ' +
        'not to that wrapper.')
    }
    if (derived.unreached.length) {
      caveats.push(
        `${derived.unreached.length} file(s) provided are never imported by \`${entry}\` ` +
        `(${derived.unreached.join(', ')}) and were left out of the order.`)
    }
  }

  return ok({
    ...result,
    derivedFrom: derived,
    caveats,
    note: (result.ok
      ? 'The declared order is achievable.'
      : 'Layer order beats specificity, so no selector weight recovers these. Fix ' +
        'the order rather than the selectors.') + ' ' + (derived
      ? 'Load order was derived by following @import from the entry, not taken on trust.'
      : 'This reads text: it assumes the files are given in the order the document ' +
        'loads them, and cannot check that. Pass `entry` to have the order derived ' +
        'from the @import graph instead.'),
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
          description: 'The stylesheets. In document load order, unless you pass `entry`.',
          items: {
            type: 'object',
            required: ['name', 'css'],
            properties: { name: { type: 'string' }, css: { type: 'string' } },
          },
        },
        entry: {
          type: 'string',
          description: 'Name of the entry stylesheet. Given one, load order is derived by ' +
            'following its @import graph rather than trusting the order of `files` — which ' +
            'is the only part of this answer that can otherwise be silently wrong.',
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
  {
    name: 'emit_probe',
    title: 'Emit a browser harness you run against your own build',
    description:
      'Returns a self-contained HTML file that measures computed styles, or drives an ' +
      'interaction and asserts on the result, in your own browser against your own ' +
      'build. Use it for the questions static analysis cannot reach — a scroll mask ' +
      'that only engages once content overflows, a scroll-spy that sets an attribute ' +
      'part-way down, a theme observer. For "which rule set this property and why", ' +
      'use resolve_cascade or explain_slot instead: those need no browser at all. ' +
      'The server generates the file and never executes anything.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['computed', 'interaction'], description: 'Measure values, or drive steps and assert.' },
        pages: {
          type: 'array', items: { type: 'string' },
          description: 'Same-origin URLs in your build. Relative paths work if you save the probe beside them.',
        },
        html: { type: 'string', description: 'An inline fixture instead of `pages` — for a case your real pages do not produce, such as content long enough to overflow.' },
        selectors: { type: 'array', items: { type: 'string' }, description: 'What to measure. A selector matching nothing is a reported failure.' },
        properties: { type: 'array', items: { type: 'string' }, description: 'CSS properties to read, computed.' },
        steps: {
          type: 'array',
          description: 'Interaction steps, in order.',
          items: {
            type: 'object',
            properties: {
              scroll: { type: 'string', description: 'Selector of the scroll container.' },
              to: { description: '"end", "start", or a pixel offset.' },
              click: { type: 'string', description: 'Selector to click.' },
              set: { type: 'string', description: 'Selector whose attribute to set.' },
              attr: { type: 'string' },
              value: { type: 'string' },
              wait: { type: 'number', description: 'Milliseconds.' },
            },
          },
        },
        assertions: {
          type: 'array',
          description: 'Required for an interaction probe — steps with nothing asserted verify nothing.',
          items: {
            type: 'object',
            required: ['selector'],
            properties: {
              selector: { type: 'string' },
              property: { type: 'string', description: 'A computed CSS property to compare.' },
              attribute: { type: 'string', description: 'An attribute to compare instead.' },
              equals: { type: 'string' },
              not: { type: 'string' },
              contains: { type: 'string' },
            },
          },
        },
        themes: { type: 'array', items: { type: 'string' }, description: '`data-theme` values to run each page under.' },
        viewport: {
          type: 'object',
          properties: { width: { type: 'number' }, height: { type: 'number' } },
          description: 'Frame size. Matters for anything that depends on overflow.',
        },
        timeout: { type: 'number', description: 'Milliseconds to wait for a page before reporting it as unreachable.' },
      },
    },
    handler: () => emit_probe,
  },
  {
    name: 'resolve_cascade',
    title: 'Resolve which declaration wins for one property on one element',
    description:
      'Given stylesheets and an element\'s ancestor chain, returns every matching ' +
      'declaration of a property in cascade order, the winner, and which cascade step ' +
      'decided it — layer order, importance, specificity or source order. This is the ' +
      'tool for "why is this computing as that": it answers without a browser, and it ' +
      'names sublayer parenting, which is the cause that looks like nothing at all. ' +
      'Rules it cannot decide from an ancestor chain are reported, never dropped.',
    inputSchema: {
      type: 'object',
      required: ['files', 'path', 'property'],
      properties: {
        files: { type: 'array', description: 'The stylesheets, in load order unless you pass `entry`.', items: {
            type: 'object',
            required: ['name', 'css'],
            properties: { name: { type: 'string' }, css: { type: 'string' } },
          }, },
        entry: { type: 'string', description: 'Derive load order from this file\'s @import graph instead of trusting the order of `files`.' },
        path: {
          type: 'array',
          description: 'The element\'s ancestor chain, outermost first; the last entry is the element itself.',
          items: {
            type: 'object',
            properties: {
              tag: { type: 'string', description: 'Element name, e.g. "kbd".' },
              id: { type: 'string' },
              classes: { type: 'array', items: { type: 'string' } },
              attrs: { type: 'object', description: 'Attribute name to value, e.g. { "data-theme": "dark" }.' },
            },
          },
        },
        property: { type: 'string', description: 'A slot such as `--weight`, or a plain property such as `font-weight`.' },
        viewport: { type: 'object', properties: { width: { type: 'number' } }, description: 'Recorded, not evaluated: @media conditions are reported per declaration rather than decided.' },
      },
    },
    handler: () => resolve_cascade,
  },
  {
    name: 'explain_slot',
    title: 'Explain whether the paint rule applies a slot, or it reverts',
    description:
      'The largen-specific question: for one slot on one element, is it set, and does ' +
      'the paint rule paint it — or does it resolve guaranteed-invalid so `revert-layer` ' +
      'fires and the property goes back to the user-agent stylesheet? Catches ' +
      '`--fg: inherit`, which reads as "use the surrounding colour" and does the ' +
      'opposite, and `--bg: initial`, which strips a slot deliberately and looks like a ' +
      'class that is not applying.',
    inputSchema: {
      type: 'object',
      required: ['files', 'path', 'slot'],
      properties: {
        files: { type: 'array', description: 'The stylesheets, in load order unless you pass `entry`.', items: {
            type: 'object',
            required: ['name', 'css'],
            properties: { name: { type: 'string' }, css: { type: 'string' } },
          }, },
        entry: { type: 'string', description: 'Derive load order from this file\'s @import graph.' },
        path: {
          type: 'array',
          description: 'The element\'s ancestor chain, outermost first.',
          items: {
            type: 'object',
            properties: {
              tag: { type: 'string', description: 'Element name, e.g. "kbd".' },
              id: { type: 'string' },
              classes: { type: 'array', items: { type: 'string' } },
              attrs: { type: 'object', description: 'Attribute name to value, e.g. { "data-theme": "dark" }.' },
            },
          },
        },
        slot: { type: 'string', description: 'A registered slot, such as `--fg`.' },
      },
    },
    handler: () => explain_slot,
  },
]

export { SOURCE, SLOTS }
