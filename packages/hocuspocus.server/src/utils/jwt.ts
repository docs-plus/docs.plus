import jwt from 'jsonwebtoken'
import { jwtLogger } from '../lib/logger'

/**
 * Verify and decode a JWT token
 * @param token - The JWT token to verify
 * @returns Decoded token payload or null if verification fails
 */
export const verifyJWT = (token: string): any | null => {
  const secret = process.env.JWT_SECRET

  if (!secret) {
    jwtLogger.error('JWT_SECRET not configured - token verification disabled')
    // In production, this should throw an error
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be configured in production')
    }
    return null
  }

  try {
    const decoded = jwt.verify(token, secret)
    return decoded
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      jwtLogger.warn('Token expired')
    } else if (error instanceof jwt.JsonWebTokenError) {
      jwtLogger.warn('Invalid token signature')
    } else {
      jwtLogger.error({ err: error }, 'JWT verification failed')
    }
    return null
  }
}

/**
 * Decode JWT without verification (use only when verification is done elsewhere)
 * @param token - The JWT token to decode
 * @returns Decoded token payload or null
 */
export const decodeJWT = (token: string): any | null => {
  try {
    return jwt.decode(token)
  } catch (error) {
    jwtLogger.error({ err: error }, 'JWT decode failed')
    return null
  }
}

/**
 * Extract user from token string or return null
 * Used in controllers where token might be missing
 */
export const extractUserFromToken = (token?: string, userId?: string): any | null => {
  if (!token || !userId) return null

  const decoded = verifyJWT(token)

  if (!decoded) {
    return null
  }

  return { ...decoded, id: userId }
}

