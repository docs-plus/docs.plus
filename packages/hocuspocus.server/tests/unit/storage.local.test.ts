import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test'
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
    test('should throw and log error when upload fails', async () => {
      const consoleErrorSpy = mock(() => {})
      const originalConsoleError = console.error
      console.error = consoleErrorSpy

      // Create a file that will cause an error (invalid path with null bytes)
      const invalidFile = new File(['test data'], 'test.jpg', { type: 'image/jpeg' })

      try {
        await storageLocal.upload('\0invalid-path', invalidFile)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBeDefined()
        expect(consoleErrorSpy).toHaveBeenCalled()
        expect(consoleErrorSpy.mock.calls[0][0]).toBe('[hypermultimedia]: localUploadMedia')
      }

      // Restore
      console.error = originalConsoleError
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
      const consoleErrorSpy = mock(() => {})
      const originalConsoleError = console.error
      console.error = consoleErrorSpy

      // Set invalid path to cause error
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
      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(consoleErrorSpy.mock.calls[0][0]).toBe('[hypermultimedia]: localGetMedia')

      // Restore
      console.error = originalConsoleError
      delete process.env.LOCAL_STORAGE_PATH
    })
  })
})

