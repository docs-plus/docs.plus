import mime from 'mime'
import { extractFileType } from './fileType'
import path from 'path'
import { mkdir } from 'fs/promises'
import type { Context } from 'hono'
import type { StorageUploadResponse } from '../../types'

const PLUGIN_NAME = 'hypermultimedia'

export const upload = async (documentId: string, file: File): Promise<StorageUploadResponse> => {
  try {
    const format = mime.getExtension(file.type) || 'bin'
    const fileName = `${crypto.randomUUID()}.${format}`
    const dirPath = `./temp/${PLUGIN_NAME}/${documentId}`
    const filePath = path.join(dirPath, fileName)
    const fileType = extractFileType(file.type)

    // Create directory if it doesn't exist
    await mkdir(dirPath, { recursive: true })

    // Use Bun's native write for better performance
    const buffer = await file.arrayBuffer()
    await Bun.write(filePath, buffer)

    return {
      type: 'localStorage',
      error: false,
      fileAddress: `${documentId}/${fileName}`,
      fileType
    }
  } catch (error) {
    console.error(`[hypermultimedia]: localUploadMedia`, error)
    throw error
  }
}

export const get = async (documentId: string, mediaId: string, c: Context) => {
  try {
    const filePath = path.join(
      process.cwd(),
      `${process.env.LOCAL_STORAGE_PATH}/${documentId}/${mediaId}`
    )

    // Use Bun.file for efficient file handling
    const file = Bun.file(filePath)
    const exists = await file.exists()

    if (!exists) {
      return c.json({ error: 'File not found' }, 404)
    }

    const contentType = mime.getType(mediaId) || 'application/octet-stream'

    return c.body(await file.arrayBuffer(), 200, {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${mediaId}"`,
      'Accept-Ranges': 'bytes'
    })
  } catch (error) {
    console.error(`[hypermultimedia]: localGetMedia`, error)
    return c.json({ error: 'Error retrieving file' }, 500)
  }
}
