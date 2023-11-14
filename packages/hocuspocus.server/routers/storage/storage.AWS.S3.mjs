import { S3 } from '@aws-sdk/client-s3'
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import mime from 'mime-types'

const s3Client = new S3({
  endpoint: process.env.DO_STORAGE_ENDPOINT,
  region: process.env.DO_STORAGE_REGION,
  credentials: {
    accessKeyId: process.env.DO_STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.DO_STORAGE_SECRET_ACCESS_KEY
  }
})

/**
 * Generates an S3 key for the given document ID and file name.
 * @param {string} documentId - The ID of the document.
 * @param {string} fileName - The name of the file.
 * @returns {string} The generated S3 key.
 */
const generateS3Key = (documentId, fileName) => {
  return `${process.env.NODE_ENV}/${documentId}/${fileName}`
}

/**
 * Uploads a file to AWS S3.
 * @async
 * @param {string} documentId - The ID of the document to associate the file with.
 * @param {string} fileName - The name of the file to upload.
 * @param {Buffer} fileContent - The content of the file to upload.
 * @returns {Promise<void>} A promise that resolves when the file has been uploaded.
 * @throws Will throw an error if the upload fails.
 */
export const upload = async (documentId, fileName, fileContent) => {
  const Key = generateS3Key(documentId, fileName)
  const bucketParams = {
    Bucket: process.env.DO_STORAGE_BUCKET,
    Key,
    Body: fileContent
    // Only add 'public-read' if necessary
    // ACL: 'public-read'
  }

  const objectCommand = new PutObjectCommand(bucketParams)
  return s3Client.send(objectCommand)
}

/**
 * Streams a file from AWS S3.
 * @async
 * @param {string} documentId - The ID of the document the file is associated with.
 * @param {string} fileName - The name of the file to stream.
 * @param {Object} res - The response object to stream the file to.
 * @returns {Promise<void>} A promise that resolves when the file has been streamed.
 * @throws Will throw an error if streaming fails.
 */
export const get = async (documentId, fileName, res) => {
  const Key = generateS3Key(documentId, fileName)
  const bucketParams = {
    Bucket: process.env.DO_STORAGE_BUCKET,
    Key
  }

  try {
    const s3Request = new GetObjectCommand(bucketParams)
    const s3Response = await s3Client.send(s3Request)
    const contentType = mime.contentType(fileName) || 'application/octet-stream'

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Content-Length': s3Response.ContentLength,
      ETag: s3Response.ETag,
      'Accept-Ranges': 'bytes',
      'Last-Modified': s3Response.LastModified
    })

    // Remove unnecessary or insecure headers, we handel this in nginx and nodejs server
    res.removeHeader('cross-origin-opener-policy')
    res.removeHeader('cross-origin-resource-policy')

    s3Response.Body.pipe(res)
  } catch (err) {
    console.error('Error getting file from AWS S3:', err)
    throw err // Re-throw the error after logging
  }
}
