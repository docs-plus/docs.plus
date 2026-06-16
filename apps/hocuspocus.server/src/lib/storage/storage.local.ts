import { mkdir } from 'fs/promises'
import type { Context } from 'hono'
import mime from 'mime'
import path from 'path'

import type { StorageUploadResponse } from '../../types'
import { storageLocalLogger } from '../logger'
import { extractFileType } from './fileType'
const PLUGIN_NAME = 'hypermultimedia'

export const upload = async (documentId: string, file: File): Promise<StorageUploadResponse> => {
  try {
    const format = mime.getExtension(file.type) || 'bin'
    const fileName = `${crypto.randomUUID()}.${format}`
    const dirPath = `./temp/${PLUGIN_NAME}/${documentId}`
    const filePath = path.join(dirPath, fileName)
    const fileType = extractFileType(file.type)

    await mkdir(dirPath, { recursive: true })

    const buffer = await file.arrayBuffer()
    await Bun.write(filePath, buffer)

    storageLocalLogger.info(
      { documentId, fileName, fileSize: file.size },
      'File uploaded to local storage'
    )

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
    const storageRoot = path.resolve(
      process.cwd(),
      process.env.LOCAL_STORAGE_PATH || `./temp/${PLUGIN_NAME}`
    )
    const filePath = path.resolve(storageRoot, documentId, mediaId)

    // Containment guard: never serve a path that resolves outside the storage root.
    if (filePath !== storageRoot && !filePath.startsWith(storageRoot + path.sep)) {
      return c.json({ error: 'Invalid media path' }, 400)
    }

    const file = Bun.file(filePath)
    const exists = await file.exists()

    if (!exists) {
      return c.json({ error: 'File not found' }, 404)
    }

    const contentType = mime.getType(mediaId) || 'application/octet-stream'

    storageLocalLogger.debug(
      { documentId, mediaId, fileSize: file.size },
      'File retrieved from local storage'
    )

    return c.body(await file.arrayBuffer(), 200, {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${mediaId}"`,
      'Accept-Ranges': 'bytes'
    })
  } catch (error) {
    storageLocalLogger.error(
      { err: error, documentId, mediaId },
      'Error retrieving file from local storage'
    )
    return c.json({ error: 'Error retrieving file' }, 500)
  }
}
