/* largen — explain what a slot does on one element.
 *
 * The narrow, largen-specific question that a general cascade resolver answers
 * only halfway: not just "which declaration set --fg", but "does the paint rule
 * therefore apply it, or does it revert — and to what?"
 *
 * THE TRAP THIS EXISTS FOR
 *
 * A migration wrote `--fg: inherit` on a link, saw the surrounding colour, and
 * shipped it. It was right by accident: an unrelated rule happened to be the
 * revert target. Remove that rule and the links go user-agent blue, because
 * `inherit` on a slot registered with `inherits: false` and no `initial-value`
 * asks the parent for a value the parent does not have either, which lands on the
 * initial value, which is guaranteed-invalid. The paint rule's
 * `var(--fg, revert-layer)` then fires and hands the property to the UA
 * stylesheet. The recipe that actually inherits is `--fg: currentColor`.
 *
 * That reasoning is three steps deep and every step is correct-looking. It is
 * documented now, but a paragraph that states a rule helps only someone who
 * already suspects it applies to their line. This applies it to their line.
 *
 * WHAT IS DERIVED AND WHAT IS ILLUSTRATED
 *
 * That a slot reverts is derived from the stylesheets and is certain. What it
 * reverts TO is the user-agent stylesheet, which is not an input and differs
 * between engines. So the two are kept apart in the output and the second is
 * labelled with the engine it was measured on. A caller who needs the exact
 * value for their browser gets an emit_probe instead of a confident guess.
 */
import { resolveProperty, INVALIDATING_KEYWORDS } from './cascade.js'
import UA from './ua-defaults.json' with { type: 'json' }

/** Which CSS property each slot drives, read from the paint rule itself so this
 *  cannot drift from the rule that actually consults them. */
export function paintMap(paintCss) {
  const slotToProperty = new Map()
  const propertyToSlot = new Map()
  const clean = String(paintCss).replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of clean.matchAll(/([a-z-]+)\s*:\s*var\(\s*(--[\w-]+)\s*,\s*revert-layer\s*\)/g)) {
    slotToProperty.set(m[2], m[1])
    propertyToSlot.set(m[1], m[2])
  }
  return { slotToProperty, propertyToSlot }
}

export const uaDefaults = UA

/** What the UA stylesheet gives this property on this element, if we measured it. */
function uaValue(tag, property) {
  const el = UA.elements[String(tag || '').toLowerCase()]
  if (!el || el[property] === undefined) return null
  return { value: el[property], engine: UA.engine, measured: UA.measured, illustrative: true }
}

/**
 * @param {object} options
 * @param {Array<{name,css}>} options.files
 * @param {string} [options.entry]
 * @param {Array<object>} options.path   ancestor chain, outermost first
 * @param {string} options.slot          e.g. '--fg'
 * @param {string} options.paintCss      the paint rule's source
 */
export function explainSlot({ files, entry, path, slot, paintCss }) {
  if (typeof slot !== 'string' || !slot.startsWith('--')) {
    throw new Error('slot must be a custom property name such as --fg')
  }
  const { slotToProperty } = paintMap(paintCss)
  const property = slotToProperty.get(slot) ?? null

  const resolved = resolveProperty({ files, entry, path, property: slot })
  const subject = path[path.length - 1]
  const winner = resolved.winner
  const notes = []
  const warnings = []

  let state, setBy = null
  if (!winner) {
    state = 'unset'
  } else {
    setBy = {
      file: winner.file, line: winner.line, layer: winner.layer,
      selector: winner.selector, value: winner.value, important: winner.important,
    }
    const keyword = winner.value.trim().toLowerCase()
    if (INVALIDATING_KEYWORDS.has(keyword)) state = `invalidated by \`${keyword}\``
    else if (keyword === 'revert' || keyword === 'revert-layer') state = `rolled back by \`${keyword}\``
    else state = 'set'
  }

  const invalid = state === 'unset' || state.startsWith('invalidated')
  const applies = !invalid && state === 'set'

  if (property) {
    if (invalid) {
      notes.push(
        `${slot} resolves guaranteed-invalid, so the paint rule's ` +
        `\`${property}: var(${slot}, revert-layer)\` falls back to \`revert-layer\` and ` +
        `${property} reverts to the user-agent stylesheet.`)
    } else if (applies) {
      notes.push(`The paint rule applies it: \`${property}: var(${slot}, revert-layer)\` → \`${winner.value}\`.`)
    }
  } else {
    notes.push(`${slot} is not read by the paint rule, so setting it paints nothing directly. ` +
      'It may still feed another slot through a derivation.')
  }

  /* The specific mistake, with the specific fix. */
  if (winner && winner.value.trim().toLowerCase() === 'inherit') {
    warnings.push({
      rule: 'inherit-does-not-inherit',
      message: `\`${slot}: inherit\` does not inherit.`,
      why:
        `Every slot is registered \`inherits: false\` with no \`initial-value\`. ` +
        `\`inherit\` asks the parent for its ${slot}; the parent does not inherit it ` +
        'either, so what arrives is the initial value, which is guaranteed-invalid. ' +
        `The paint rule's fallback then fires and ${property || 'the property'} reverts ` +
        'to the user-agent stylesheet — on a link, that is blue.',
      fix: property === 'color'
        ? `Use \`${slot}: currentColor\`, or set \`color: inherit\` directly.`
        : `Use an explicit value, or set \`${property || 'the property'}: inherit\` directly.`,
    })
  }
  if (winner && (winner.value.trim().toLowerCase() === 'initial' || winner.value.trim().toLowerCase() === 'unset')) {
    notes.push(
      `\`${slot}: ${winner.value.trim()}\` is the un-styling idiom: it returns the slot to ` +
      'guaranteed-invalid so largen stops painting this property. That is deliberate and ' +
      'useful when running alongside another framework — but if a component downstream looks ' +
      'as though its class is not applying, this is why.')
  }

  const reverts = property && invalid ? uaValue(subject.tag, property) : null
  if (property && invalid && !reverts) {
    notes.push(`No measured user-agent value for \`${property}\` on \`<${subject.tag}>\`; ` +
      'use emit_probe to read it in your own browser.')
  }

  return {
    slot,
    property,
    state,
    applies,
    setBy,
    revertsTo: reverts,
    notes,
    warnings,
    declarations: resolved.declarations,
    undecidable: resolved.undecidable,
    layerOrder: resolved.layerOrder,
    derivation: resolved.derivation,
    caveat: reverts
      ? 'The revert is derived from your stylesheets and is certain. The user-agent value ' +
        'shown is illustrative: it was measured on ' + reverts.engine + ' and other engines differ.'
      : null,
  }
}

export default explainSlot
