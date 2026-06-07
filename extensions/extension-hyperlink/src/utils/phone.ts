// E.164 phone detection + `tel:` canonicalization. `+`-prefix and
// 8–15 digits required so years, ZIPs, and bare numerics don't autolink.
// Formatting (space, dash, dot, parens) is stripped per RFC 3966.

// Anchored at both ends so the caller-must-trim contract is enforced.
const PHONE_SHAPE_RE = /^\+\d[\d\s.\-()]{4,18}\d$/

const NON_DIGIT_RE = /\D/g

/**
 * True iff the entire trimmed input is one E.164-compatible phone
 * number. Returns the canonical `tel:+CCNSN` href on success. Strict
 * full-match only — autolink handles embedded phones.
 */
export const isBarePhone = (
  trimmed: string
): { ok: true; href: string } | { ok: false; href?: undefined } => {
  if (!PHONE_SHAPE_RE.test(trimmed)) return { ok: false }
  const digits = trimmed.replace(NON_DIGIT_RE, '')
  // E.164 §6.2.1: total length 8–15 digits including country code.
  if (digits.length < 8 || digits.length > 15) return { ok: false }
  return { ok: true, href: `tel:+${digits}` }
}
