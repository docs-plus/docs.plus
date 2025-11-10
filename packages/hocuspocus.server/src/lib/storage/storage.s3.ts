import { S3Client } from 'bun'
import mime from 'mime'
import type { Context } from 'hono'
import { storageS3Logger } from '../logger'

// Bun's native S3 client - blazing fast with zero overhead
const s3Client = new S3Client({
  accessKeyId: process.env.DO_STORAGE_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.DO_STORAGE_SECRET_ACCESS_KEY || '',
  bucket: process.env.DO_STORAGE_BUCKET || '',
  endpoint: process.env.DO_STORAGE_ENDPOINT
})

const generateS3Key = (documentId: string, fileName: string): string => {
  return `${process.env.NODE_ENV}/${documentId}/${fileName}`
}

/**
 * - Direct S3 write without intermediate buffers
 * - Automatic content-type detection
 * - Built-in caching headers
 */
export const upload = async (
  documentId: string,
  fileName: string,
  fileContent: Buffer | Uint8Array | ArrayBuffer
) => {
  const key = generateS3Key(documentId, fileName)
  const contentType = mime.getType(fileName) || 'application/octet-stream'
  const startTime = performance.now()

  try {
    // Bun's native write - accepts Buffer, Uint8Array, ArrayBuffer, or string
    await s3Client.write(key, fileContent, {
      type: contentType,
      acl: 'public-read'
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

/**
 * Bun-native S3 download - blazing fast with S3File API
 * - Zero overhead with lazy file references
 * - Direct arrayBuffer() without stream conversion
 * - Automatic metadata handling
 */
export const get = async (documentId: string, fileName: string, c: Context) => {
  const key = generateS3Key(documentId, fileName)

  try {
    const startTime = performance.now()

    // Get lazy reference to S3 file (synchronous, no network call)
    const s3File = s3Client.file(key)

    // Check if file exists (optional but good practice)
    const exists = await s3File.exists()
    if (!exists) {
      return c.json({ error: 'File not found' }, 404)
    }

    // Download file - Bun's optimized arrayBuffer() method
    const buffer = await s3File.arrayBuffer()
    const duration = performance.now() - startTime

    const contentType = mime.getType(fileName) || 'application/octet-stream'

    storageS3Logger.info(
      { key, sizeKB: (buffer.byteLength / 1024).toFixed(2), durationMs: duration.toFixed(2) },
      'S3 download successful'
    )

    return c.body(buffer, 200, {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Content-Length': buffer.byteLength.toString(),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable'
    })
  } catch (err) {
    storageS3Logger.error({ err, key }, 'S3 download failed')
    return c.json({ error: 'Error retrieving file from storage' }, 500)
  }
}

/**
 * Get presigned URL for direct client-side uploads/downloads
 * - Synchronous operation (no network request needed)
 * - Allows clients to upload/download directly to/from S3
 * - Reduces server load and improves performance
 */
export const getSignedUploadUrl = (
  documentId: string,
  fileName: string,
  expiresIn: number = 3600
): string => {
  const key = generateS3Key(documentId, fileName)

  // Get lazy reference to S3 file
  const s3File = s3Client.file(key)

  // Presign is synchronous - no network request needed!
  const url = s3File.presign({
    acl: 'public-read',
    expiresIn
  })

  return url
}
