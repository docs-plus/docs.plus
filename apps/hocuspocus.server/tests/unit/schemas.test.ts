import { describe, test, expect } from 'bun:test'
import {
  createDocumentSchema,
  updateDocumentMetadataSchema,
  documentQuerySchema
} from '../../src/schemas/document.schema'

describe('Document Schemas', () => {
  describe('createDocumentSchema', () => {
    test('should validate correct document data', () => {
      const validData = {
        title: 'Test Document',
        slug: 'test-document',
        description: 'A test document',
        keywords: ['test', 'document']
      }

      const result = createDocumentSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    test('should require title field', () => {
      const invalidData = {
        slug: 'test-document',
        description: 'A test document'
      }

      const result = createDocumentSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    test('should require slug field', () => {
      const invalidData = {
        title: 'Test Document',
        description: 'A test document'
      }

      const result = createDocumentSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    test('should allow empty description', () => {
      const validData = {
        title: 'Test Document',
        slug: 'test-document',
        description: ''
      }

      const result = createDocumentSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    test('should allow empty keywords array', () => {
      const validData = {
        title: 'Test Document',
        slug: 'test-document',
        keywords: []
      }

      const result = createDocumentSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    test('should reject invalid title type', () => {
      const invalidData = {
        title: 123,
        slug: 'test-document'
      }

      const result = createDocumentSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    test('should reject invalid keywords type', () => {
      const invalidData = {
        title: 'Test',
        slug: 'test',
        keywords: 'not-an-array'
      }

      const result = createDocumentSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('updateDocumentMetadataSchema', () => {
    test('should validate correct update data', () => {
      const validData = {
        title: 'Updated Title',
        description: 'Updated description',
        keywords: ['updated'],
        readOnly: true
      }

      const result = updateDocumentMetadataSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    test('should allow partial updates', () => {
      const validData = {
        title: 'Only Title'
      }

      const result = updateDocumentMetadataSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    test('should allow empty object', () => {
      const result = updateDocumentMetadataSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    test('should validate readOnly as boolean', () => {
      const invalidData = {
        readOnly: 'yes'
      }

      const result = updateDocumentMetadataSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    test('should validate keywords as array', () => {
      const invalidData = {
        keywords: 'string'
      }

      const result = updateDocumentMetadataSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('documentQuerySchema', () => {
    test('should validate query parameters', () => {
      const validData = {
        title: 'search term',
        keywords: 'test',
        description: 'example',
        limit: '10',
        offset: '0'
      }

      const result = documentQuerySchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    test('should allow empty query', () => {
      const result = documentQuerySchema.safeParse({})
      expect(result.success).toBe(true)
    })

    test('should default limit to 10', () => {
      const result = documentQuerySchema.parse({})
      expect(result.limit).toBe('10')
    })

    test('should default offset to 0', () => {
      const result = documentQuerySchema.parse({})
      expect(result.offset).toBe('0')
    })

    test('should allow custom limit', () => {
      const result = documentQuerySchema.parse({ limit: '50' })
      expect(result.limit).toBe('50')
    })

    test('should allow custom offset', () => {
      const result = documentQuerySchema.parse({ offset: '20' })
      expect(result.offset).toBe('20')
    })
  })
})
