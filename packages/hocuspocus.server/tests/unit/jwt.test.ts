import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import jwt from 'jsonwebtoken'
import { verifyJWT, decodeJWT, extractUserFromToken } from '../../src/utils/jwt'

describe('JWT Utilities', () => {
  const originalJwtSecret = process.env.JWT_SECRET
  const testSecret = 'test-secret-key-for-jwt-verification'

  beforeAll(() => {
    process.env.JWT_SECRET = testSecret
  })

  afterAll(() => {
    process.env.JWT_SECRET = originalJwtSecret
  })

  describe('verifyJWT', () => {
    test('should verify valid JWT token', () => {
      const payload = { sub: 'user123', email: 'test@example.com' }
      const token = jwt.sign(payload, testSecret)

      const result = verifyJWT(token)

      expect(result).toBeDefined()
      expect(result.sub).toBe('user123')
      expect(result.email).toBe('test@example.com')
    })

    test('should return null for invalid signature', () => {
      const payload = { sub: 'user123' }
      const token = jwt.sign(payload, 'wrong-secret')

      const result = verifyJWT(token)

      expect(result).toBeNull()
    })

    test('should return null for expired token', () => {
      const payload = { sub: 'user123', exp: Math.floor(Date.now() / 1000) - 3600 }
      const token = jwt.sign(payload, testSecret)

      const result = verifyJWT(token)

      expect(result).toBeNull()
    })

    test('should return null for malformed token', () => {
      const result = verifyJWT('not.a.valid.token')

      expect(result).toBeNull()
    })

    test('should handle token with future expiration', () => {
      const payload = {
        sub: 'user123',
        exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      }
      const token = jwt.sign(payload, testSecret)

      const result = verifyJWT(token)

      expect(result).toBeDefined()
      expect(result.sub).toBe('user123')
    })
  })

  describe('verifyJWT without JWT_SECRET', () => {
    test('should throw error in production without JWT_SECRET', () => {
      const originalSecret = process.env.JWT_SECRET
      const originalEnv = process.env.NODE_ENV

      process.env.JWT_SECRET = ''
      process.env.NODE_ENV = 'production'

      const payload = { sub: 'user123' }
      const token = jwt.sign(payload, testSecret)

      expect(() => verifyJWT(token)).toThrow('JWT_SECRET must be configured in production')

      process.env.JWT_SECRET = originalSecret
      process.env.NODE_ENV = originalEnv
    })

    test('should return null in development without JWT_SECRET', () => {
      const originalSecret = process.env.JWT_SECRET
      const originalEnv = process.env.NODE_ENV

      process.env.JWT_SECRET = ''
      process.env.NODE_ENV = 'development'

      const payload = { sub: 'user123' }
      const token = jwt.sign(payload, testSecret)

      const result = verifyJWT(token)

      expect(result).toBeNull()

      process.env.JWT_SECRET = originalSecret
      process.env.NODE_ENV = originalEnv
    })
  })

  describe('decodeJWT', () => {
    test('should decode valid JWT without verification', () => {
      const payload = { sub: 'user123', email: 'test@example.com' }
      const token = jwt.sign(payload, 'any-secret')

      const result = decodeJWT(token)

      expect(result).toBeDefined()
      expect(result.sub).toBe('user123')
      expect(result.email).toBe('test@example.com')
    })

    test('should decode JWT even with wrong signature', () => {
      const payload = { sub: 'user123' }
      const token = jwt.sign(payload, 'wrong-secret')

      const result = decodeJWT(token)

      expect(result).toBeDefined()
      expect(result.sub).toBe('user123')
    })

    test('should return null for malformed token', () => {
      const result = decodeJWT('not-a-valid-token')

      expect(result).toBeNull()
    })

    test('should decode expired token', () => {
      const payload = { sub: 'user123', exp: Math.floor(Date.now() / 1000) - 3600 }
      const token = jwt.sign(payload, testSecret)

      const result = decodeJWT(token)

      expect(result).toBeDefined()
      expect(result.sub).toBe('user123')
    })
  })

  describe('extractUserFromToken', () => {
    test('should extract user from valid token', () => {
      const payload = { sub: 'user123', email: 'test@example.com', name: 'Test User' }
      const token = jwt.sign(payload, testSecret)

      const result = extractUserFromToken(token, 'user123')

      expect(result).toBeDefined()
      expect(result.sub).toBe('user123')
      expect(result.email).toBe('test@example.com')
      expect(result.id).toBe('user123')
    })

    test('should return null if token is missing', () => {
      const result = extractUserFromToken(undefined, 'user123')

      expect(result).toBeNull()
    })

    test('should return null if userId is missing', () => {
      const payload = { sub: 'user123' }
      const token = jwt.sign(payload, testSecret)

      const result = extractUserFromToken(token, undefined)

      expect(result).toBeNull()
    })

    test('should return null if token verification fails', () => {
      const payload = { sub: 'user123' }
      const token = jwt.sign(payload, 'wrong-secret')

      const result = extractUserFromToken(token, 'user123')

      expect(result).toBeNull()
    })

    test('should add userId as id field', () => {
      const payload = { sub: 'user123' }
      const token = jwt.sign(payload, testSecret)

      const result = extractUserFromToken(token, 'custom-id')

      expect(result).toBeDefined()
      expect(result.id).toBe('custom-id')
      expect(result.sub).toBe('user123')
    })
  })

  describe('Token with custom claims', () => {
    test('should preserve custom claims in verified token', () => {
      const payload = {
        sub: 'user123',
        email: 'test@example.com',
        role: 'admin',
        permissions: ['read', 'write'],
        metadata: { org: 'acme' }
      }
      const token = jwt.sign(payload, testSecret)

      const result = verifyJWT(token)

      expect(result).toBeDefined()
      expect(result.role).toBe('admin')
      expect(result.permissions).toEqual(['read', 'write'])
      expect(result.metadata).toEqual({ org: 'acme' })
    })
  })

  describe('Edge cases', () => {
    test('should handle empty string token', () => {
      const result = verifyJWT('')

      expect(result).toBeNull()
    })

    test('should handle token with only dots', () => {
      const result = verifyJWT('...')

      expect(result).toBeNull()
    })

    test('should handle very long token', () => {
      const largePayload = {
        sub: 'user123',
        data: 'x'.repeat(10000)
      }
      const token = jwt.sign(largePayload, testSecret)

      const result = verifyJWT(token)

      expect(result).toBeDefined()
      expect(result.sub).toBe('user123')
    })
  })
})
