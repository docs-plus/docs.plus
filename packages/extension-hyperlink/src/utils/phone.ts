/**
 * E.164 phone-number detection and `tel:` URI canonicalization.
 *
 * Strict by design: only `+`-prefixed numbers with 8–15 digits are
 * recognized, so years (`2024`), ZIPs (`90210`), and bare numerics
 * (`5551234567`) never get silently turned into broken `tel:` links
 * inside prose.
 *
 * Formatting (space, dash, dot, parens) is accepted on input and
 * stripped from the canonical href per RFC 3966 (`tel:+E.164`).
 */

// `+`, digit, 4–18 chars of digits + permitted formatting, digit. The
// digit anchors at both ends turn the caller-must-trim contract into a
// defense-in-depth check rather than a convention.
const PHONE_SHAPE_RE = /^\+\d[\d\s.\-()]{4,18}\d$/

const NON_DIGIT_RE = /\D/g

/**
 * True iff the entire trimmed input is one E.164-compatible phone
 * number. Returns the canonical `tel:+CCNSN` href on success.
 *
 * Strict full-match only — does NOT find phones embedded in larger
 * strings; that's autolink's job (which already operates on a single
 * whitespace-delimited token).
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
