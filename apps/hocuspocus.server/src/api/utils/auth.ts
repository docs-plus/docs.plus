import { verifySupabaseToken } from '../../utils/jwt'

/**
 * Extract user from token for REST API controllers
 * Used when token and userId are provided separately
 */
export const extractUserFromToken = async (
  token?: string,
  userId?: string
): Promise<{ sub: string; email?: string; user_metadata?: any } | null> => {
  if (!token || !userId) return null

  const user = await verifySupabaseToken(token)

  if (!user || user.sub !== userId) {
    return null
  }

  return user
}
