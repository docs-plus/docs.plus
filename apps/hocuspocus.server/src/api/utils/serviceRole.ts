/**
 * Gate for the push/email gateway endpoints: exact service-role key match only.
 * Never trust JWT payload claims here — an unsigned token can forge `role`.
 */
export function verifyServiceRole(authHeader: string | undefined): boolean {
  if (!authHeader) return false

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) return false

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  return token === serviceRoleKey
}
