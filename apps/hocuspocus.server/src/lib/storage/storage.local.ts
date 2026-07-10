import { mkdir, rm } from 'fs/promises'
import type { Context } from 'hono'
import mime from 'mime'
import path from 'path'

import type { StorageUploadResponse } from '../../types'
import { captureUnknown } from '../instrument'
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
    // SVG/HTML render script at the object origin — force download for those.
    const disposition = /svg\+xml|html/i.test(contentType) ? 'attachment' : 'inline'

    storageLocalLogger.debug(
      { documentId, mediaId, fileSize: file.size },
      'File retrieved from local storage'
    )

    // Return the lazy file handle so Bun.serve streams it and answers Range
    // (206) itself, instead of buffering the whole file into memory.
    return new Response(file, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${disposition}; filename="${mediaId}"`,
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    })
  } catch (error) {
    storageLocalLogger.error(
      { err: error, documentId, mediaId },
      'Error retrieving file from local storage'
    )
    captureUnknown(error)
    return c.json({ error: 'Error retrieving file' }, 500)
  }
}

// `force` makes a missing dir a no-op (the reaper retries); the falsy guard stops
// an empty id from nuking the whole hypermultimedia tree.
export const deleteByPrefix = async (documentId: string): Promise<void> => {
  if (!documentId) return
  const dirPath = `./temp/${PLUGIN_NAME}/${documentId}`
  await rm(dirPath, { recursive: true, force: true })
  storageLocalLogger.info(
    { documentId, dirPath },
    'Purged document editor media from local storage'
  )
}
