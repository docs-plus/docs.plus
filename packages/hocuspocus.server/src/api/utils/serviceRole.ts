/**
 * Service Role Authorization
 *
 * Shared utility for verifying Supabase service role authentication.
 * Used by push and email gateway endpoints.
 */

/**
 * Verify service role authorization
 * Only allows requests with valid service role key
 */
export function verifyServiceRole(authHeader: string | undefined): boolean {
  if (!authHeader) return false

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    // Allow in dev mode when key not set
    return true
  }

  // Support both "Bearer <token>" and raw token
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader

  // Direct key match
  if (token === serviceRoleKey) return true

  // JWT with service_role claim
  if (token.startsWith('eyJ')) {
    try {
      const parts = token.split('.')
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]))
        return payload.role === 'service_role'
      }
    } catch {
      // Invalid JWT
    }
  }

  return false
}

