import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import mime from 'mime'
import type { Context } from 'hono'
import { Readable } from 'stream'

const s3Client = new S3Client({
  endpoint: process.env.DO_STORAGE_ENDPOINT,
  region: process.env.DO_STORAGE_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.DO_STORAGE_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.DO_STORAGE_SECRET_ACCESS_KEY || ''
  }
})

const generateS3Key = (documentId: string, fileName: string): string => {
  return `${process.env.NODE_ENV}/${documentId}/${fileName}`
}

export const upload = async (
  documentId: string,
  fileName: string,
  fileContent: Buffer | Uint8Array
) => {
  const Key = generateS3Key(documentId, fileName)
  const bucketParams = {
    Bucket: process.env.DO_STORAGE_BUCKET || '',
    Key,
    Body: fileContent
  }

  const command = new PutObjectCommand(bucketParams)
  return s3Client.send(command)
}

export const get = async (documentId: string, fileName: string, c: Context) => {
  const Key = generateS3Key(documentId, fileName)
  const bucketParams = {
    Bucket: process.env.DO_STORAGE_BUCKET || '',
    Key
  }

  try {
    const command = new GetObjectCommand(bucketParams)
    const response = await s3Client.send(command)
    const contentType = mime.getType(fileName) || 'application/octet-stream'

    // Convert stream to buffer for Hono
    if (response.Body instanceof Readable) {
      const chunks: Uint8Array[] = []
      for await (const chunk of response.Body) {
        chunks.push(chunk)
      }
      const buffer = Buffer.concat(chunks)

      return c.body(buffer, 200, {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Content-Length': response.ContentLength?.toString() || buffer.length.toString(),
        ETag: response.ETag || '',
        'Accept-Ranges': 'bytes',
        'Last-Modified': response.LastModified?.toISOString() || ''
      })
    }

    return c.json({ error: 'Invalid response body' }, 500)
  } catch (err) {
    console.error('Error getting file from S3:', err)
    return c.json({ error: 'Error retrieving file from storage' }, 500)
  }
}
