import { S3Client } from 'bun'
import type { Context } from 'hono'
import mime from 'mime'

import { captureUnknown } from '../instrument'
import { storageS3Logger } from '../logger'

const s3Client = new S3Client({
  accessKeyId: process.env.DO_STORAGE_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.DO_STORAGE_SECRET_ACCESS_KEY || '',
  bucket: process.env.DO_STORAGE_BUCKET || '',
  endpoint: process.env.DO_STORAGE_ENDPOINT
})

// Object-key layout is NODE_ENV/<documentId>/<file>. Upload and delete-by-prefix
// share this so a key-scheme change can't desync writes from the reaper's purge.
const s3Prefix = (documentId: string): string => `${process.env.NODE_ENV}/${documentId}/`

const generateS3Key = (documentId: string, fileName: string): string =>
  `${s3Prefix(documentId)}${fileName}`

export const upload = async (
  documentId: string,
  fileName: string,
  fileContent: Buffer | Uint8Array | ArrayBuffer
) => {
  const key = generateS3Key(documentId, fileName)
  const contentType = mime.getType(fileName) || 'application/octet-stream'
  const startTime = performance.now()

  // SVG/HTML render script at the object origin; the public-read Spaces URL
  // bypasses our proxy, so stamp the stored object itself to force download.
  const contentDisposition = /svg\+xml|html/i.test(contentType) ? 'attachment' : undefined

  try {
    await s3Client.write(key, fileContent, {
      type: contentType,
      acl: 'public-read',
      ...(contentDisposition ? { contentDisposition } : {})
    })

    const duration = performance.now() - startTime
    const size =
      fileContent instanceof ArrayBuffer
        ? fileContent.byteLength
        : fileContent.byteLength || fileContent.length

    storageS3Logger.info(
      { key, sizeKB: (size / 1024).toFixed(2), durationMs: duration.toFixed(2) },
      'S3 upload successful'
    )
  } catch (error) {
    storageS3Logger.error({ err: error, key }, 'S3 upload failed')
    throw error
  }
}

export const get = async (documentId: string, fileName: string, c: Context) => {
  const key = generateS3Key(documentId, fileName)

  try {
    const startTime = performance.now()

    // Lazy reference: synchronous, no network call.
    const s3File = s3Client.file(key)

    const exists = await s3File.exists()
    if (!exists) {
      return c.json({ error: 'File not found' }, 404)
    }

    const contentType = mime.getType(fileName) || 'application/octet-stream'
    // SVG/HTML render script at the object origin — force download for those.
    const disposition = /svg\+xml|html/i.test(contentType) ? 'attachment' : 'inline'

    storageS3Logger.info(
      { key, durationMs: (performance.now() - startTime).toFixed(2) },
      'S3 download streaming'
    )

    // Stream the S3 object instead of buffering the whole file into memory.
    return new Response(s3File.stream(), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${disposition}; filename="${fileName}"`,
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    })
  } catch (err) {
    storageS3Logger.error({ err, key }, 'S3 download failed')
    captureUnknown(err)
    return c.json({ error: 'Error retrieving file from storage' }, 500)
  }
}

// Bun's S3 has no server-side copy, so read the object and re-write it through
// `upload` — that keeps the acl and content-disposition policy in one place. The
// file name is preserved on purpose: it makes the caller's URL rewrite a pure id
// swap. `false` means the source object is gone (its prefix was already purged).
export const copyObject = async (
  sourceDocumentId: string,
  fileName: string,
  targetDocumentId: string
): Promise<boolean> => {
  const sourceKey = generateS3Key(sourceDocumentId, fileName)
  const sourceFile = s3Client.file(sourceKey)

  if (!(await sourceFile.exists())) {
    storageS3Logger.warn({ sourceKey, targetDocumentId }, 'Referenced S3 media object is missing')
    return false
  }

  await upload(targetDocumentId, fileName, await sourceFile.arrayBuffer())
  return true
}

// Bun's S3 has no batch delete, so page the listing and delete key-by-key. An
// empty listing is a no-op — the reaper retries this and most docs have no media.
export const deleteByPrefix = async (documentId: string): Promise<void> => {
  if (!documentId) return
  const prefix = s3Prefix(documentId)
  let startAfter: string | undefined
  let deleted = 0

  do {
    const page = await s3Client.list({ prefix, maxKeys: 1000, startAfter })
    const contents = page.contents ?? []
    for (const { key } of contents) {
      await s3Client.delete(key)
      deleted++
    }
    startAfter = page.isTruncated ? contents.at(-1)?.key : undefined
  } while (startAfter)

  if (deleted > 0) {
    storageS3Logger.info({ documentId, deleted }, 'Purged document editor media from S3')
  }
}
