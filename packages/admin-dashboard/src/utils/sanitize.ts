/**
 * Input sanitization utilities for security
 */

/**
 * Sanitize search input for use in database queries
 * - Escapes special PostgreSQL LIKE/ILIKE pattern characters: % _ \
 * - Limits length to prevent DoS
 * - Trims whitespace
 *
 * @param input - Raw user input
 * @param maxLength - Maximum allowed length (default: 100)
 * @returns Sanitized string safe for use in LIKE/ILIKE queries
 */
export function sanitizeSearchInput(input: string, maxLength = 100): string {
  if (!input || typeof input !== 'string') {
    return ''
  }

  return (
    input
      // Trim whitespace
      .trim()
      // Limit length to prevent DoS
      .slice(0, maxLength)
      // Escape PostgreSQL LIKE pattern characters
      // Order matters: escape backslash first, then % and _
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_')
  )
}

/**
 * Validate that a string is a valid UUID format
 * Used for ID parameters
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

/**
 * Validate that a string is a valid integer ID
 * Used for numeric ID parameters
 */
export function isValidIntId(id: string): boolean {
  const num = parseInt(id, 10)
  return !isNaN(num) && num > 0 && String(num) === id
}
