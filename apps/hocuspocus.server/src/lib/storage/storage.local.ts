import { mkdir, rm } from 'fs/promises'
import type { Context } from 'hono'
import mime from 'mime'
import path from 'path'

import type { StorageUploadResponse } from '../../types'
import { captureUnknown } from '../instrument'
import { storageLocalLogger } from '../logger'
import { extractFileType } from './fileType'
const PLUGIN_NAME = 'hypermultimedia'

// One root for every path here, so `copyObject`'s containment check and
// `deleteByPrefix`'s purge cover exactly what `get` serves. Resolved per call and
// not once: `LOCAL_STORAGE_PATH` is swapped at runtime.
const storageRoot = (): string =>
  path.resolve(process.cwd(), process.env.LOCAL_STORAGE_PATH || `./temp/${PLUGIN_NAME}`)

export const upload = async (documentId: string, file: File): Promise<StorageUploadResponse> => {
  try {
    const format = mime.getExtension(file.type) || 'bin'
    const fileName = `${crypto.randomUUID()}.${format}`
    const dirPath = path.join(storageRoot(), documentId)
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
    const root = storageRoot()
    const filePath = path.resolve(root, documentId, mediaId)

    // Containment guard: never serve a path that resolves outside the storage root.
    if (filePath !== root && !filePath.startsWith(root + path.sep)) {
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

// S3 `copyObject`'s local twin. Both ids and the file name come from a URL stored in document
// content, so both paths resolve against the same root `get` serves from. Both must land inside
// that root: a `..` in either would write outside the media tree. `false` means the source object
// is gone (its prefix was already purged).
export const copyObject = async (
  sourceDocumentId: string,
  fileName: string,
  targetDocumentId: string
): Promise<boolean> => {
  const root = storageRoot()
  const sourcePath = path.resolve(root, sourceDocumentId, fileName)
  const targetPath = path.resolve(root, targetDocumentId, fileName)
  const contained = (candidate: string) => candidate.startsWith(root + path.sep)

  // A refusal is not an absence, so it throws rather than reporting a copy that
  // never happened. The duplicate would otherwise land with URLs under a prefix
  // nothing ever wrote. The URL scan drops dot segments, so this stays a guard.
  if (!contained(sourcePath) || !contained(targetPath)) {
    storageLocalLogger.error(
      { sourceDocumentId, targetDocumentId, fileName },
      'Refusing a media copy that resolves outside the storage root'
    )
    throw new Error('Media copy resolves outside the storage root')
  }

  const sourceFile = Bun.file(sourcePath)
  if (!(await sourceFile.exists())) {
    storageLocalLogger.warn(
      { sourceDocumentId, targetDocumentId, fileName },
      'Referenced local media object is missing'
    )
    return false
  }

  await mkdir(path.dirname(targetPath), { recursive: true })
  await Bun.write(targetPath, sourceFile)
  return true
}

// `force` makes a missing dir a no-op (the reaper retries); the falsy guard stops
// an empty id from nuking the whole hypermultimedia tree.
export const deleteByPrefix = async (documentId: string): Promise<void> => {
  if (!documentId) return
  const dirPath = path.join(storageRoot(), documentId)
  await rm(dirPath, { recursive: true, force: true })
  storageLocalLogger.info(
    { documentId, dirPath },
    'Purged document editor media from local storage'
  )
}
