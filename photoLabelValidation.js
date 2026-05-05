/**
 * Dev-only validation utility for photo descriptions.
 * Logs a console.warn when a description doesn't match any known-good pattern.
 * Does not block execution or affect production behavior.
 */

const ALLOWED_PATTERNS = [
  // Roof test square damage
  /^Shows hail hit on .+\.$/,
  /^Shows wind damage to .+\.$/,
  // Roof detail ("Shows [values]." or fixed string)
  /^Shows .+\.$/,
  /^Roof detail photo\.$/,
  // Slope and test square overviews (may contain counts)
  /^Slope overview — /,
  /^Test square (overview|detail) — /,
  /^No claim related damage to shingle\.$/,
  // Standard damage to a named target
  /^(Hail|Wind|Water|Fire|Wear and tear|Mechanical|Prior|Smoke or fire|Impact|Functional) damage to .+\.$/,
  /^Damage to .+\.$/,
  // AC structured outputs
  /^AC unit \d+ - .+\.$/,
  // No damage
  /^No claim related damage observed\.$/,
  /^No claim related damage to .+\.$/,
  // Interior room description ("Room: Description.")
  /^[A-Z].+: .+\.$/,
  // Interior fallback
  /^Damage observed to .+\.$/,
  // Generic single-pill fallback
  /^(Hail|Wind|Water|Fire|Wear and tear|Damage) damage observed\.$/,
  // Overview (always prefixed, may or may not end with period)
  /^Overview — /,
  // Fixed documentation strings
  /^Risk shot\.$/,
  /^Address verification\.$/,
  /^Contractor business card\.$/,
  // Fence no-damage
  /^No claim related damage to fence\.$/,
  // Personal property and label fallback (permissive — ends with period)
  /^.+ - .+\.$/,
  /^.+\.$/,
]

export function validatePhotoDescription(description) {
  if (!description) {
    console.warn('[PhotoLabelValidation] Empty or missing description')
    return
  }
  const isValid = ALLOWED_PATTERNS.some((pattern) => pattern.test(description))
  if (!isValid) {
    console.warn('[PhotoLabelValidation] Unexpected format:', description)
  }
}
