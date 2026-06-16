import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import * as storageLocal from '../../src/lib/storage/storage.local'
import { mkdir, rm } from 'fs/promises'
import path from 'path'
import { Hono } from 'hono'

describe('Local Storage - Error Handling', () => {
  const testDir = './temp/test-storage'

  beforeEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true })
    } catch {}
  })

  afterEach(async () => {
    // Clean up after tests
    try {
      await rm(testDir, { recursive: true, force: true })
    } catch {}
  })

  describe('upload() error handling', () => {
    test('should re-throw the underlying error when upload fails', async () => {
      // Create a file whose document id forces an invalid path (null byte)
      const invalidFile = new File(['test data'], 'test.jpg', { type: 'image/jpeg' })

      await expect(storageLocal.upload('\0invalid-path', invalidFile)).rejects.toThrow()
    })
  })

  describe('get() error handling', () => {
    test('should return 404 when file does not exist', async () => {
      const app = new Hono()

      app.get('/test', async (c) => {
        return storageLocal.get('nonexistent-doc', 'nonexistent-file.jpg', c)
      })

      const response = await app.request('http://localhost/test')
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('File not found')
    })

    test('should return file when it exists', async () => {
      // Set up a real file
      const originalPath = process.env.LOCAL_STORAGE_PATH
      process.env.LOCAL_STORAGE_PATH = testDir
      const docId = 'test-doc-123'
      const fileName = 'test-file.jpg'
      const fileContent = 'test file content'

      try {
        // Create directory and file
        const dirPath = path.join(process.cwd(), testDir, docId)
        await mkdir(dirPath, { recursive: true })
        await Bun.write(path.join(dirPath, fileName), fileContent)

        const app = new Hono()

        app.get('/test', async (c) => {
          return storageLocal.get(docId, fileName, c)
        })

        const response = await app.request('http://localhost/test')

        expect(response.status).toBe(200)
        expect(response.headers.get('Content-Type')).toBe('image/jpeg')
        expect(response.headers.get('Content-Disposition')).toBe(`inline; filename="${fileName}"`)
        expect(response.headers.get('Accept-Ranges')).toBe('bytes')

        const body = await response.text()
        expect(body).toBe(fileContent)
      } finally {
        // Restore
        if (originalPath) {
          process.env.LOCAL_STORAGE_PATH = originalPath
        } else {
          delete process.env.LOCAL_STORAGE_PATH
        }
      }
    })

    test('should return 500 when unexpected error occurs', async () => {
      // Set invalid path (null byte) to force Bun.file to throw
      process.env.LOCAL_STORAGE_PATH = '\0invalid'

      const app = new Hono()

      app.get('/test', async (c) => {
        return storageLocal.get('doc-id', 'file.jpg', c)
      })

      const response = await app.request('http://localhost/test')
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Error retrieving file')

      // Restore
      delete process.env.LOCAL_STORAGE_PATH
    })
  })
})
