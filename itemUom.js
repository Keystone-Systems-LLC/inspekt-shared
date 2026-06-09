// itemUom.js — single source of truth for inspection item Unit of Measure.
//
// Shared by the iOS app (whether to show the per-item quantity stepper) and
// the cloud GLR generator (whether to print a replacement count). Keeping this
// in inspekt-shared guarantees the capture UI and the report can never drift —
// if the app shows a quantity selector for an item, the report prints that
// count, and vice versa.
//
// Model: items are either counted as Each (EA) — discrete units an adjuster can
// count on-site (windows, screens, vents, downspouts) — or measured runs/areas
// (LF/SF: gutters, fascia, siding) whose footage is taken off in the estimate,
// not guessed in the field. Only EA items get a quantity; runs/areas show no
// count in the GLR.
//
// Default for unknown keys = counted (EA): most items and ALL custom add-ons
// are countable, so the no-count list is the explicit exception set. Interior
// rooms and other-structure surfaces don't flow through the elevation count
// renderers, so only dwelling exterior keys need listing here today.

// Item keys (which equal the report's glrTarget key for non-custom items) that
// are measured runs/areas — NO on-site count, NO quantity stepper, GLR shows
// just the item name. Downspouts are intentionally NOT here: an adjuster can
// count downspouts, so they stay EA.
export const NO_COUNT_ITEM_KEYS = new Set([
  'soffit',
  'fascia',
  'gutter',
  'gutter_guards',
  'trim',
  'siding',
  'garage_door_trim',
  'decorative_trim',
])

// True if the item is counted as Each (EA) — i.e. the adjuster captures a
// replacement quantity and the GLR prints it. Compound child keys
// (e.g. "window_screen") and custom items (uuid keys) default to counted.
export function isCountedItem(key) {
  if (key == null) return true
  const k = String(key).toLowerCase().trim()
  if (!k) return true
  return !NO_COUNT_ITEM_KEYS.has(k)
}
