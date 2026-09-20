/* largen — the DTCG token layer.
 *
 * A W3C Design Tokens Community Group document is the interchange format for a
 * largen theme: `src/tokens.css` and `themes/*.css` export to it, a designer's
 * export imports from it, and `largen verify` asserts the two cannot drift. The
 * CSS stays the source of truth — the DTCG draft this targets says of itself
 * "do not attempt to implement this version", so the generated side is the one
 * that should be cheap to regenerate.
 *
 * String in, string out. Nothing here touches the filesystem, because the MCP
 * server imports `genai/` and a server receiving a document over the wire has no
 * files to read. The registered slot list arrives as an argument for the same
 * reason.
 *
 * Three decisions are worth stating, because the code looks arbitrary without
 * them:
 *
 *   The vocabulary is DECLARED, not inferred. Every themeable custom property
 *   has an entry below naming its DTCG path, its `$type` and its structural rule
 *   (tone-pair member, alias target, rem-only). Inference would be enough to
 *   export "whatever is there" and is useless for validation, which has to know
 *   that `--line-height-base` is a `number` even when a consumer supplies a
 *   dimension. The guarantee inference gave — a token added to the CSS is never
 *   silently dropped — is kept by `verify` failing and naming it.
 *
 *   A reference becomes `var()`, not a value. `--tone: var(--neutral)` and
 *   `--lift-1: 0 1px 2px var(--shade)` are dependencies the CSS declares, and
 *   the dark theme moves its shadows by moving `--shade` alone. So a reference
 *   to a VOCABULARY token imports back as `var(--that-prop)` rather than as the
 *   referenced literal; only references to project extras are flattened, since
 *   nothing downstream knows those names. A reference exists in the JSON exactly
 *   where a `var()` exists in the CSS — `--neutral` matching `--ink` in both
 *   shipped themes is coincidence, not a claim, so it exports as a literal.
 *
 *   Hex is authoritative. The export writes both `components` and `hex` so every
 *   consumer can read one of them, but emission prefers `hex`, which makes the
 *   round trip byte-exact instead of dependent on float formatting. Import takes
 *   either; when both are present and disagree by more than rounding it is an
 *   error rather than a silent preference.
 *
 * Units are never normalised (`0.12s` stays seconds), and a zero length emits as
 * a bare `0` — round-trip exactness is the invariant, and normalising would cost
 * it for no consumer benefit.
 */

export const DTCG_VERSION = '2025.10'

/* Names an extra may not flatten to: the tone family the algebra derives on `*`
   and the size multiplier. `--tone` and `--tone-contrast` are in this list and
   are also vocabulary tokens, so a collision with those two is reported as a
   collision with the vocabulary, which is the more useful message. */
export const DERIVED_NAMES = [
  '--tone', '--tone-soft', '--tone-ink', '--tone-line', '--tone-contrast', '--scale',
]

const TONES = ['primary', 'secondary', 'success', 'info', 'warning', 'danger', 'neutral']
const HUES = [
  'red', 'pink', 'grape', 'violet', 'indigo', 'blue', 'cyan', 'teal',
  'green', 'lime', 'yellow', 'orange', 'slate', 'stone',
]
const SPACES = ['1', '2', '3', '4', '6', '8', '12', '16', '24']

/* The table. Order is `src/tokens.css` order, and that is load-bearing: an
   imported document emits its declarations in this order, so a round trip
   reproduces the file it came from line for line. */
export const VOCABULARY = [
  { prop: '--canvas', path: 'canvas', type: 'color', description: 'the page' },
  { prop: '--ink', path: 'ink', type: 'color', description: 'body text' },
  { prop: '--ink-muted', path: 'ink-muted', type: 'color', description: 'secondary text' },
  { prop: '--surface', path: 'surface', type: 'color', description: 'raised or recessed panels' },
  { prop: '--line', path: 'line', type: 'color', description: 'borders and rules' },

  ...TONES.flatMap((name) => [
    { prop: `--${name}`, path: `tone.${name}.$root`, type: 'color', pair: { group: `tone.${name}`, member: '$root' } },
    { prop: `--${name}-on`, path: `tone.${name}.on`, type: 'color', pair: { group: `tone.${name}`, member: 'on' } },
  ]),

  ...HUES.map((name) => ({ prop: `--hue-${name}`, path: `hue.${name}`, type: 'color' })),

  { prop: '--radius-sm', path: 'radius.sm', type: 'dimension' },
  { prop: '--radius-md', path: 'radius.md', type: 'dimension' },
  { prop: '--radius-lg', path: 'radius.lg', type: 'dimension' },
  { prop: '--hairline', path: 'hairline', type: 'dimension' },

  ...SPACES.map((n) => ({ prop: `--space-${n}`, path: `space.${n}`, type: 'dimension', unit: 'rem' })),

  { prop: '--speed', path: 'speed', type: 'duration' },

  { prop: '--font-ui', path: 'font.ui', type: 'fontFamily' },
  { prop: '--font-mono', path: 'font.mono', type: 'fontFamily' },
  { prop: '--text-base', path: 'text-base', type: 'dimension' },
  { prop: '--line-height-base', path: 'line-height-base', type: 'number' },
  { prop: '--weight-normal', path: 'weight.normal', type: 'fontWeight' },
  { prop: '--weight-medium', path: 'weight.medium', type: 'fontWeight' },
  { prop: '--weight-bold', path: 'weight.bold', type: 'fontWeight' },

  { prop: '--shade', path: 'shade', type: 'color' },
  { prop: '--shade-strong', path: 'shade-strong', type: 'color' },
  { prop: '--lift-1', path: 'lift.1', type: 'shadow' },
  { prop: '--lift-2', path: 'lift.2', type: 'shadow' },

  { prop: '--tone', path: 'default-tone.$root', type: 'color', alias: 'tone.neutral.$root' },
  { prop: '--tone-contrast', path: 'default-tone.contrast', type: 'color', alias: 'tone.neutral.on' },
]

/* Group-level `$type` and prose. A group's `$type` is inherited by its members,
   so `tone.primary.$root` carries no `$type` of its own; `default-tone` declares
   none because it is a pair of aliases rather than a family. */
const GROUPS = {
  tone: {
    type: 'color',
    description: 'Semantic tones. Each pairs with the colour text takes when sitting ON it.',
  },
  hue: {
    type: 'color',
    description: 'Hues, for components that need a colour outside the semantic set.',
  },
  radius: { type: 'dimension' },
  space: {
    type: 'dimension',
    description:
      'Rhythm between things, in rem on purpose: a section gap must not grow ' +
      'when a component inside it carries data-size="lg".',
  },
  font: { type: 'fontFamily' },
  weight: { type: 'fontWeight' },
  lift: { type: 'shadow' },
  'default-tone': {
    description: '--tone / --tone-contrast: the fallback an un-toned component resolves against.',
  },
}

const BY_PROP = new Map(VOCABULARY.map((e) => [e.prop, e]))
const BY_PATH = new Map(VOCABULARY.map((e) => [e.path, e]))

/* --- Small text helpers --------------------------------------------------- */

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, ' ')
const ws = (s) => s.replace(/\s+/g, ' ').trim()
const num = (n) => String(Number(n))
const round4 = (n) => Math.round(n * 1e4) / 1e4
/* null as well as undefined: a caller with no theme name to give passes one or
   the other, and `"theme": null` in a shipped document is noise a consumer has
   to interpret. */
const omitEmpty = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null))

class ValueError extends Error {}
const bad = (m) => { throw new ValueError(m) }

/** Split on a separator that is not inside parentheses or a string. */
function splitTop(s, sep) {
  const out = []
  let depth = 0, cur = '', quote = null
  for (const ch of s) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue }
    if (ch === '(') depth++
    else if (ch === ')') depth--
    const isSep = depth === 0 && (sep === ' ' ? /\s/.test(ch) : ch === sep)
    if (isSep) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/** The body of a brace-delimited block whose opening brace is at `open`. */
function block(s, open) {
  let depth = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === '{') depth++
    else if (s[i] === '}') { depth--; if (depth === 0) return s.slice(open + 1, i) }
  }
  return s.slice(open + 1)
}

/* --- Parsing a token stylesheet ------------------------------------------- */

/**
 * Read the first rule inside `@layer largen.tokens` — or, when the sheet is
 * unlayered, the first rule in the sheet.
 *
 * @param {string} css
 * @returns {{ selector: string, colorScheme: string|undefined, tokens: Map<string,string> }}
 */
export function parseTokensCss(css) {
  const clean = stripComments(css)
  const layer = clean.match(/@layer\s+largen\.tokens\s*\{/)
  const body = layer ? block(clean, layer.index + layer[0].length - 1) : clean

  const open = body.indexOf('{')
  const tokens = new Map()
  if (open === -1) return { selector: '', colorScheme: undefined, tokens }

  const selector = ws(body.slice(0, open))
  let colorScheme
  for (const decl of splitTop(block(body, open), ';')) {
    const colon = decl.indexOf(':')
    if (colon === -1) continue
    const prop = decl.slice(0, colon).trim()
    const value = ws(decl.slice(colon + 1))
    if (prop === 'color-scheme') colorScheme = value
    else if (prop.startsWith('--')) tokens.set(prop, value)
  }
  return { selector, colorScheme, tokens }
}

/* --- Value codecs --------------------------------------------------------- */

const VAR_RE = /^var\(\s*(--[\w-]+)\s*\)$/
const NUMBER_RE = /^-?(?:\d+\.?\d*|\.\d+)$/
const LENGTH_RE = /^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/i
const HEX_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const FONT_NAME_RE = /^(?:"[^"]*"|'[^']*'|-?[A-Za-z_][\w-]*)$/

function hexToRgb(hex) {
  let h = hex.slice(1)
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : undefined
  return { r, g, b, a }
}

const rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')

function decodeColor(raw) {
  if (HEX_RE.test(raw)) {
    const { r, g, b, a } = hexToRgb(raw)
    const v = { colorSpace: 'srgb', components: [r, g, b].map((c) => round4(c / 255)), hex: raw.toLowerCase() }
    if (a !== undefined) v.alpha = round4(a)
    return v
  }
  const m = /^rgba?\(([^)]*)\)$/i.exec(raw)
  if (!m) bad(`not a colour: ${raw}`)
  const parts = m[1].replace(/\//g, ' ').split(/[\s,]+/).filter(Boolean)
  if (parts.length < 3 || parts.length > 4) bad(`not a colour: ${raw}`)
  const channel = (p, scale) => (p.endsWith('%') ? Number(p.slice(0, -1)) / 100 : Number(p) / scale)
  const v = { colorSpace: 'srgb', components: parts.slice(0, 3).map((p) => round4(channel(p, 255))) }
  if (parts.length === 4) v.alpha = round4(channel(parts[3], 1))
  return v
}

function encodeColor(v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    /* A string here is a typo, not an escape hatch: passing it through as CSS is
       exactly the failure the validator exists to refuse. */
    bad(`not a colour: ${JSON.stringify(v)} — a colour is an object with hex ` +
        'and/or colorSpace + components, or a {reference}')
  }
  const { hex, components, colorSpace, alpha } = v
  if (hex === undefined && components === undefined) bad('a colour needs hex or components')
  if (hex !== undefined && (typeof hex !== 'string' || !HEX_RE.test(hex))) bad(`hex is not a colour: ${hex}`)
  if (components !== undefined) {
    if (!Array.isArray(components) || components.length < 3 || components.slice(0, 3).some((c) => typeof c !== 'number')) {
      bad('components must be three numbers in 0..1')
    }
    if (colorSpace !== undefined && colorSpace !== 'srgb') bad(`colorSpace ${colorSpace} is not supported; largen emits srgb`)
  }
  if (alpha !== undefined && (typeof alpha !== 'number' || alpha < 0 || alpha > 1)) bad('alpha must be a number in 0..1')

  const fromHex = hex !== undefined ? hexToRgb(hex) : undefined
  if (fromHex && components !== undefined) {
    const got = [fromHex.r, fromHex.g, fromHex.b]
    for (let i = 0; i < 3; i++) {
      if (Math.abs(components[i] * 255 - got[i]) > 0.5) {
        bad(`hex ${hex} and components [${components.slice(0, 3).join(', ')}] disagree`)
      }
    }
  }

  const a = alpha ?? fromHex?.a
  const hexCarriesAlpha = hex !== undefined && (hex.length === 5 || hex.length === 9)
  if (hex !== undefined && (hexCarriesAlpha || a === undefined || a === 1)) return hex.toLowerCase()

  const [r, g, b] = fromHex
    ? [fromHex.r, fromHex.g, fromHex.b]
    : components.slice(0, 3).map((c) => Math.round(c * 255))
  if (a !== undefined && a < 1) return `rgba(${r}, ${g}, ${b}, ${num(a)})`
  return rgbToHex(r, g, b)
}

function decodeLength(raw, zeroUnit) {
  const m = LENGTH_RE.exec(raw)
  if (!m) bad(`not a length: ${raw}`)
  const value = Number(m[1])
  const unit = m[2] || (value === 0 ? zeroUnit : bad(`${raw} has no unit`))
  return { value, unit }
}

function encodeLength(v, { bareZero = true } = {}) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) bad('a dimension is { value, unit }')
  if (typeof v.value !== 'number' || !Number.isFinite(v.value)) bad('a dimension needs a numeric value')
  if (typeof v.unit !== 'string' || !v.unit) bad('a dimension needs a unit, even when the value is 0')
  /* DTCG insists on a unit even for zero; CSS authors write a bare 0, and the
     round trip has to reproduce what they wrote. */
  return v.value === 0 && bareZero ? '0' : `${num(v.value)}${v.unit}`
}

const unquote = (s) => (/^(".*"|'.*')$/.test(s) ? s.slice(1, -1) : s)
const quoteIfNeeded = (s) => (/\s/.test(s) ? `"${s}"` : s)

function decodeFontFamily(raw) {
  const parts = splitTop(raw, ',')
  if (!parts.length) bad('an empty font stack')
  return parts.map((p) => unquote(p))
}

function encodeFontFamily(v) {
  const list = typeof v === 'string' ? [v] : v
  if (!Array.isArray(list) || !list.length || list.some((n) => typeof n !== 'string')) {
    bad('a fontFamily is a string or an array of strings')
  }
  return list.map(quoteIfNeeded).join(', ')
}

const FONT_WEIGHT_KEYWORDS = new Set([
  'thin', 'hairline', 'extra-light', 'ultra-light', 'light', 'normal', 'regular', 'book',
  'medium', 'semi-bold', 'demi-bold', 'bold', 'extra-bold', 'ultra-bold', 'black', 'heavy',
  'extra-black', 'ultra-black',
])

function encodeFontWeight(v) {
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v < 1 || v > 1000) bad(`a fontWeight is 1..1000, got ${v}`)
    return num(v)
  }
  if (typeof v === 'string' && FONT_WEIGHT_KEYWORDS.has(v)) return v
  bad('a fontWeight is a number 1..1000 or a DTCG weight keyword')
}

function encodeNumber(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) bad(`not a number: ${JSON.stringify(v)}`)
  return num(v)
}

function decodeShadow(raw, ctx) {
  const parts = splitTop(raw, ' ')
  const inset = parts.includes('inset')
  const rest = parts.filter((p) => p !== 'inset')
  if (rest.length < 3) bad(`not a shadow: ${raw}`)
  const colour = rest.pop()
  if (rest.length < 2 || rest.length > 4) bad(`a shadow takes two to four lengths, got ${rest.length}`)
  const [offsetX, offsetY, blur = { value: 0, unit: 'px' }, spread = { value: 0, unit: 'px' }] =
    rest.map((p) => decodeLength(p, 'px'))
  const v = { color: ctx.colourIn(colour), offsetX, offsetY, blur, spread }
  if (inset) v.inset = true
  return v
}

function encodeShadow(v, ctx) {
  if (Array.isArray(v)) return v.map((one) => encodeShadow(one, ctx)).join(', ')
  if (v === null || typeof v !== 'object') bad('a shadow is an object with color, offsetX, offsetY and blur')
  const colour = typeof v.color === 'string' ? ctx.colourOut(v.color) : encodeColor(v.color)
  const spread = v.spread && v.spread.value !== 0 ? ` ${encodeLength(v.spread)}` : ''
  const lengths = [v.offsetX, v.offsetY, v.blur ?? { value: 0, unit: 'px' }].map((d) => encodeLength(d))
  return `${v.inset ? 'inset ' : ''}${lengths.join(' ')}${spread} ${colour}`
}

const CODECS = {
  color: { decode: (raw) => decodeColor(raw), encode: (v) => encodeColor(v) },
  dimension: { decode: (raw) => decodeLength(raw, 'rem'), encode: (v) => encodeLength(v) },
  duration: { decode: (raw) => decodeLength(raw, 's'), encode: (v) => encodeLength(v, { bareZero: false }) },
  fontFamily: { decode: (raw) => decodeFontFamily(raw), encode: (v) => encodeFontFamily(v) },
  fontWeight: { decode: (raw) => Number(raw), encode: (v) => encodeFontWeight(v) },
  number: { decode: (raw) => Number(raw), encode: (v) => encodeNumber(v) },
  shadow: { decode: (raw, ctx) => decodeShadow(raw, ctx), encode: (v, ctx) => encodeShadow(v, ctx) },
}

/** The DTCG path a `var(--x)` should reference: the table's, or the flattened name. */
const refFor = (prop) => (BY_PROP.get(prop)?.path ?? prop.replace(/^--/, ''))

/** `a.b.$root` → `--a-b`: `$root` contributes nothing to the flattened name. */
const flatten = (path) => '--' + path.split('.').filter((s) => s !== '$root').join('-')

const isRef = (v) => typeof v === 'string' && /^\{[^{}]+\}$/.test(v)
const refTarget = (v) => v.slice(1, -1)

/* --- CSS → DTCG ----------------------------------------------------------- */

/** Best effort for a project extra, which has no table entry to name its type. */
function inferType(raw) {
  if (HEX_RE.test(raw) || /^rgba?\([^)]*\)$/i.test(raw)) return 'color'
  if (NUMBER_RE.test(raw)) return 'number'
  if (/^-?(?:\d+\.?\d*|\.\d+)m?s$/i.test(raw)) return 'duration'
  if (LENGTH_RE.test(raw)) return 'dimension'
  const parts = splitTop(raw, ' ')
  if (parts.length >= 3 && parts.length <= 5) {
    const colour = parts[parts.length - 1]
    const lengths = parts.slice(0, -1).filter((p) => p !== 'inset')
    if ((VAR_RE.test(colour) || HEX_RE.test(colour) || /^rgba?\(/i.test(colour)) &&
        lengths.length >= 2 && lengths.every((p) => LENGTH_RE.test(p))) return 'shadow'
  }
  const stack = splitTop(raw, ',')
  if (stack.length > 1 && stack.every((n) => FONT_NAME_RE.test(n))) return 'fontFamily'
  return undefined
}

function groupTypeFor(path) {
  const segs = path.split('.')
  segs.pop()
  while (segs.length) {
    const g = GROUPS[segs.join('.')]
    if (g?.type) return g.type
    segs.pop()
  }
  return undefined
}

function place(doc, path, node) {
  const segs = path.split('.')
  const key = segs.pop()
  let cur = doc
  const prefix = []
  for (const s of segs) {
    prefix.push(s)
    if (!cur[s]) {
      cur[s] = {}
      const g = GROUPS[prefix.join('.')]
      if (g?.type) cur[s].$type = g.type
      if (g?.description) cur[s].$description = g.description
    }
    cur = cur[s]
  }
  cur[key] = node
}

/**
 * Build a DTCG document from a parsed token map.
 *
 * @param {Map<string,string>} tokens  custom property → raw CSS value
 * @param {object} meta  { version, build, theme, colorScheme, description }
 */
export function toDtcg(tokens, meta = {}) {
  const doc = {}
  if (meta.description) doc.$description = meta.description
  doc.$extensions = {
    'dev.largen': omitEmpty({
      version: meta.version,
      build: meta.build,
      dtcg: DTCG_VERSION,
      colorScheme: meta.colorScheme,
      theme: meta.theme,
    }),
  }

  const ctx = { colourIn: (raw) => (VAR_RE.test(raw) ? `{${refFor(VAR_RE.exec(raw)[1])}}` : decodeColor(raw)) }

  for (const [prop, raw] of tokens) {
    const entry = BY_PROP.get(prop)
    const path = entry ? entry.path : prop.replace(/^--/, '')
    const type = entry ? entry.type : inferType(raw)
    const node = {}

    let value, rawCss
    const varMatch = VAR_RE.exec(raw)
    if (varMatch) value = `{${refFor(varMatch[1])}}`
    else if (type && CODECS[type]) {
      /* A value the codec cannot read is not an error on export — the library's
         own files never hit it, and a consumer theme that carries clamp() should
         round-trip rather than fail. It goes through the one escape hatch. */
      try { value = CODECS[type].decode(raw, ctx) } catch { rawCss = raw }
    } else rawCss = raw

    if (type && type !== groupTypeFor(path)) node.$type = type
    if (value !== undefined) node.$value = value
    if (entry?.description) node.$description = entry.description
    if (rawCss !== undefined) node.$extensions = { 'dev.largen': { css: rawCss } }
    place(doc, path, node)
  }
  return doc
}

/* --- DTCG → CSS ----------------------------------------------------------- */

const METADATA = new Set(['$type', '$value', '$description', '$extensions', '$deprecated'])
const rawCssOf = (node) => node?.$extensions?.['dev.largen']?.css

const childKeysOf = (node) => Object.keys(node).filter((k) => k === '$root' || !k.startsWith('$'))

function shapeType(v) {
  if (Array.isArray(v)) return 'fontFamily'
  if (typeof v === 'number') return 'number'
  if (v !== null && typeof v === 'object') {
    if ('colorSpace' in v || 'hex' in v || 'components' in v) return 'color'
    if ('offsetX' in v || 'offsetY' in v) return 'shadow'
    if ('value' in v && 'unit' in v) return 'dimension'
  }
  return undefined
}

/**
 * Validate a DTCG document against the vocabulary and turn it into CSS values.
 *
 * Never throws for a problem with the document: a caller gets diagnostics and
 * decides. `--strict` is the caller's job — it promotes warnings to errors.
 *
 * @param {object} doc
 * @param {{ slots?: string[] }} options  registered slot names, from properties.css
 */
export function fromDtcg(doc, { slots = [] } = {}) {
  const errors = []
  const warnings = []
  const err = (path, message) => errors.push({ path, message })
  const warn = (path, message) => warnings.push({ path, message })

  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    err('', 'a token document is a JSON object')
    return { tokens: new Map(), colorScheme: undefined, theme: undefined, errors, warnings }
  }
  const ext = doc.$extensions?.['dev.largen'] ?? {}

  /* 1. Flatten the tree, inheriting `$type` from the groups on the way down. */
  const found = new Map()
  const walk = (node, segs, inherited) => {
    for (const key of Object.keys(node)) {
      if (key.startsWith('$') && key !== '$root') {
        if (!METADATA.has(key)) err(segs.concat(key).join('.'), `a token name may not start with $: ${key}`)
        continue
      }
      const path = segs.concat(key).join('.')
      if (key !== '$root' && /[{}.]/.test(key)) {
        err(path, `a token name may not contain { } or . : ${key}`)
        continue
      }
      const child = node[key]
      if (child === null || typeof child !== 'object' || Array.isArray(child)) {
        err(path, 'a token or group is an object')
        continue
      }
      const type = child.$type ?? inherited
      if ('$value' in child || rawCssOf(child) !== undefined || childKeysOf(child).length === 0) {
        found.set(path, { path, node: child, type })
      } else walk(child, segs.concat(key), type)
    }
  }
  walk(doc, [], undefined)

  /* 2. Resolve names and types; report the structural problems. */
  const seenProps = new Map()
  for (const t of found.values()) {
    const entry = BY_PATH.get(t.path)
    t.entry = entry
    t.prop = entry ? entry.prop : flatten(t.path)
    if (entry) {
      if (t.type && t.type !== entry.type) {
        warn(t.path, `${t.prop} is declared ${entry.type} in largen's vocabulary and this document supplies ${t.type}`)
      }
      t.type = t.type ?? entry.type
    } else if (BY_PROP.has(t.prop)) {
      err(t.path, `flattens to ${t.prop}, which is the vocabulary token ${BY_PROP.get(t.prop).path}; set it at that path`)
      t.skip = true
    } else if (slots.includes(t.prop)) {
      err(t.path, `flattens to ${t.prop}, a registered slot; the universal paint rule would read it`)
      t.skip = true
    } else if (DERIVED_NAMES.includes(t.prop)) {
      err(t.path, `flattens to ${t.prop}, which the algebra derives; overriding it from a theme breaks the derivation`)
      t.skip = true
    }
    if (seenProps.has(t.prop) && !t.skip) {
      err(t.path, `flattens to ${t.prop}, which ${seenProps.get(t.prop)} already sets`)
      t.skip = true
    } else if (!t.skip) seenProps.set(t.prop, t.path)
  }

  /* A tone without its contrast makes a solid variant impossible, so the pair is
     checked as structure rather than trusted as a convention. */
  const toneGroups = new Set()
  for (const path of found.keys()) {
    const m = /^(tone\.[^.]+)\.(?:\$root|on)$/.exec(path)
    if (m) toneGroups.add(m[1])
  }
  for (const group of toneGroups) {
    const hasRoot = found.has(`${group}.$root`)
    const hasOn = found.has(`${group}.on`)
    if (hasRoot && !hasOn) err(`${group}.$root`, `${group} sets $root without on; a theme that sets a tone sets both halves`)
    if (hasOn && !hasRoot) err(`${group}.on`, `${group} sets on without $root; a theme that sets a tone sets both halves`)
  }

  /* 3. References: every edge that lands inside this document, so a cycle is
     found before resolution walks into it. */
  const edges = (t) => {
    const out = []
    const v = t.node.$value
    if (isRef(v)) out.push(refTarget(v))
    const shadows = Array.isArray(v) ? v : [v]
    for (const s of shadows) {
      if (s !== null && typeof s === 'object' && !Array.isArray(s) && isRef(s.color)) out.push(refTarget(s.color))
    }
    return out.filter((p) => found.has(p))
  }
  const cyclic = new Set()
  const state = new Map()
  const visit = (path, stack) => {
    if (state.get(path) === 'done') return
    if (state.get(path) === 'open') {
      const cycle = stack.slice(stack.indexOf(path)).concat(path).join(' → ')
      for (const p of stack.slice(stack.indexOf(path))) cyclic.add(p)
      err(path, `reference cycle: ${cycle}`)
      return
    }
    state.set(path, 'open')
    for (const next of edges(found.get(path))) visit(next, stack.concat(path))
    state.set(path, 'done')
  }
  for (const path of found.keys()) visit(path, [])

  /* 4. Turn each token into the CSS a person would have written. */
  const resolving = new Set()
  const cssOf = (path) => {
    const t = found.get(path)
    const raw = rawCssOf(t.node)
    if (raw !== undefined) {
      if (typeof raw !== 'string') bad('$extensions["dev.largen"].css must be a string')
      return raw
    }
    if (!('$value' in t.node)) bad('no $value and no $extensions["dev.largen"].css')
    if (resolving.has(path)) bad(`reference cycle through ${path}`)

    const ctx = {
      colourOut: (ref) => {
        if (!isRef(ref)) bad(`a shadow colour is a colour object or a {reference}, got ${JSON.stringify(ref)}`)
        return follow(refTarget(ref), path)
      },
    }
    const v = t.node.$value
    if (isRef(v)) return follow(refTarget(v), path)

    const type = t.type ?? shapeType(v)
    if (!type) bad('no $type, and the value does not say what it is')
    if (!CODECS[type]) bad(`$type ${type} is not one of largen's: ${Object.keys(CODECS).join(', ')}`)
    if (t.entry?.unit && type === 'dimension' && v?.unit !== t.entry.unit) {
      bad(`space stays in ${t.entry.unit} so a section gap does not grow under the size axis; got ${v?.unit}`)
    }
    resolving.add(path)
    try { return CODECS[type].encode(v, ctx) } finally { resolving.delete(path) }
  }

  /* A reference to a VOCABULARY token becomes var(--prop) rather than the
     referenced literal, so the CSS keeps the dependency the JSON declares. */
  const follow = (target, from) => {
    const entry = BY_PATH.get(target)
    if (entry) return `var(${entry.prop})`
    if (!found.has(target)) bad(`{${target}} does not resolve — no such token in this document or in largen's vocabulary`)
    if (cyclic.has(target)) bad(`{${target}} is part of a reference cycle`)
    return cssOf(target)
  }

  const byProp = new Map()
  for (const t of found.values()) {
    if (t.skip || cyclic.has(t.path)) continue
    try { byProp.set(t.prop, cssOf(t.path)) }
    catch (e) { err(t.path, e.message) }
  }

  /* Vocabulary order first, which is `src/tokens.css` order, then extras in the
     order the document names them. That is what makes an exported theme import
     back into the file it came from. */
  const tokens = new Map()
  for (const e of VOCABULARY) if (byProp.has(e.prop)) tokens.set(e.prop, byProp.get(e.prop))
  for (const [prop, value] of byProp) if (!tokens.has(prop)) tokens.set(prop, value)

  return { tokens, colorScheme: ext.colorScheme, theme: ext.theme, errors, warnings }
}

/* --- CSS emission --------------------------------------------------------- */

/**
 * Emit a theme stylesheet from a token map.
 *
 * @param {Map<string,string>} tokens
 * @param {object} options  { theme, colorScheme, layered, schemeMedia, header }
 */
export function toThemeCss(tokens, { theme, colorScheme, layered = true, schemeMedia = false, header = '' } = {}) {
  const selector = theme ? `[data-theme="${theme}"]` : ':root'
  const decls = []
  for (const [prop, value] of tokens) decls.push(`${prop}: ${value};`)
  /* Last, where both shipped stylesheets put it: it is a property of the theme
     rather than one of its tokens, and a generated block that a person can diff
     against the hand-written one is worth the one line of care. */
  if (colorScheme) decls.push(`color-scheme: ${colorScheme};`)

  const pad = (lines, n) => lines.map((l) => (l ? ' '.repeat(n) + l : l))
  const rule = (sel, indent) => [
    `${' '.repeat(indent)}${sel} {`,
    ...pad(decls, indent + 2),
    `${' '.repeat(indent)}}`,
  ]

  const base = layered ? 2 : 0
  const out = []
  if (header) out.push(header)
  if (layered) out.push('@layer largen.tokens {')
  out.push(...rule(selector, base))
  if (schemeMedia && colorScheme) {
    /* One document, two selectors: the shipped dark theme's 22 declarations were
       written twice by hand elsewhere, and that is drift waiting to happen. */
    const other = colorScheme === 'light' ? 'dark' : 'light'
    out.push(`${' '.repeat(base)}@media (prefers-color-scheme: ${colorScheme}) {`)
    out.push(...rule(`:root:not([data-theme="${other}"])`, base + 2))
    out.push(`${' '.repeat(base)}}`)
  }
  if (layered) out.push('}')
  return out.join('\n') + '\n'
}

/**
 * The names in a token map that a theme may not set: registered slots and the
 * tone family the algebra derives.
 *
 * @param {Map<string,string>} tokens
 * @param {string[]} slots
 */
export function slotCollisions(tokens, slots = []) {
  const out = []
  for (const prop of tokens.keys()) {
    if (BY_PROP.has(prop)) continue
    if (slots.includes(prop)) out.push({ prop, reason: 'registered slot' })
    else if (DERIVED_NAMES.includes(prop)) out.push({ prop, reason: 'derived by the algebra' })
  }
  return out
}
