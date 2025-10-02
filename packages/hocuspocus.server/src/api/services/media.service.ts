import type { Context } from 'hono'
import mime from 'mime'
import { checkEnvBolean } from '../../utils'
import * as localStorage from '../../lib/storage/storage.local'
import * as S3Storage from '../../lib/storage/storage.s3'
import { extractFileType } from '../../lib/storage/fileType'

export const getMedia = async (documentId: string, mediaId: string, c: Context) => {
  if (checkEnvBolean(process.env.PERSIST_TO_LOCAL_STORAGE)) {
    return localStorage.get(documentId, mediaId, c)
  }

  return S3Storage.get(documentId, mediaId, c)
}

export const uploadMedia = async (documentId: string, mediaFile: File) => {
  const canPersist2Local = checkEnvBolean(process.env.PERSIST_TO_LOCAL_STORAGE) || false

  // Local storage
  if (canPersist2Local) {
    return await localStorage.upload(documentId, mediaFile)
  }

  // S3 storage
  if (!process.env.DO_STORAGE_ENDPOINT) {
    throw new Error('No storage configured')
  }

  const format = mime.getExtension(mediaFile.type) || 'bin'
  const fileName = `${crypto.randomUUID()}.${format}`
  const fileType = extractFileType(mediaFile.type)
  const Key = `${documentId}/${fileName}`

  const buffer = await mediaFile.arrayBuffer()
  await S3Storage.upload(documentId, fileName, new Uint8Array(buffer))

  return {
    type: 's3',
    error: false,
    fileType,
    fileName,
    fileAddress: Key
  }
}
