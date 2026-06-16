import { describe, test, expect } from 'bun:test'
import { checkEnvBoolean, generateRandomId } from '../../src/utils'

describe('Utils', () => {
  describe('checkEnvBoolean', () => {
    test('should return true for "true" string', () => {
      expect(checkEnvBoolean('true')).toBe(true)
    })

    test('should return true for "1" string', () => {
      expect(checkEnvBoolean('1')).toBe(true)
    })

    test('should return false for "false" string', () => {
      expect(checkEnvBoolean('false')).toBe(false)
    })

    test('should return false for "0" string', () => {
      expect(checkEnvBoolean('0')).toBe(false)
    })

    test('should return false for undefined', () => {
      expect(checkEnvBoolean(undefined)).toBe(false)
    })

    test('should return false for empty string', () => {
      expect(checkEnvBoolean('')).toBe(false)
    })

    test('should be case insensitive', () => {
      expect(checkEnvBoolean('TRUE')).toBe(true)
      expect(checkEnvBoolean('True')).toBe(true)
      expect(checkEnvBoolean('FALSE')).toBe(false)
    })

    test('should return false for random strings', () => {
      expect(checkEnvBoolean('yes')).toBe(false)
      expect(checkEnvBoolean('no')).toBe(false)
      expect(checkEnvBoolean('random')).toBe(false)
    })
  })

  describe('generateRandomId', () => {
    test('should generate id of default length 19', () => {
      const id = generateRandomId()
      expect(id.length).toBe(19)
    })

    test('should generate id of custom length', () => {
      const id = generateRandomId(10)
      expect(id.length).toBe(10)
    })

    test('should generate alphanumeric characters only', () => {
      const id = generateRandomId(100)
      expect(id).toMatch(/^[0-9A-Za-z]+$/)
    })

    test('should generate unique ids', () => {
      const id1 = generateRandomId()
      const id2 = generateRandomId()
      expect(id1).not.toBe(id2)
    })

    test('should work with length 1', () => {
      const id = generateRandomId(1)
      expect(id.length).toBe(1)
    })

    test('should generate many unique ids', () => {
      const ids = new Set()
      for (let i = 0; i < 1000; i++) {
        ids.add(generateRandomId())
      }
      expect(ids.size).toBe(1000)
    })
  })
})
