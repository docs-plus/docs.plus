import mime from 'mime'
import { extractFileType } from './fileType'
import path from 'path'
import { mkdir } from 'fs/promises'
import type { Context } from 'hono'
import type { StorageUploadResponse } from '../../types'
import { storageLocalLogger } from '../logger'
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

    storageLocalLogger.info({ documentId, fileName, fileSize: file.size }, 'File uploaded to local storage')

    return {
      type: 'localStorage',
      error: false,
      fileAddress: `${documentId}/${fileName}`,
      fileType
    }
  } catch (error) {
    storageLocalLogger.error({ err: error, documentId }, 'Error uploading to local storage')
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

    storageLocalLogger.debug({ documentId, mediaId, fileSize: file.size }, 'File retrieved from local storage')

    return c.body(await file.arrayBuffer(), 200, {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${mediaId}"`,
      'Accept-Ranges': 'bytes'
    })
  } catch (error) {
    storageLocalLogger.error({ err: error, documentId, mediaId }, 'Error retrieving file from local storage')
    return c.json({ error: 'Error retrieving file' }, 500)
  }
}
