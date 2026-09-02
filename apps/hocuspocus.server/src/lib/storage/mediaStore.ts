import { config } from '../../config/env'
import * as localStorage from './storage.local'
import * as S3Storage from './storage.s3'

export interface MediaStore {
  /** False only when S3 is selected and has no endpoint, so every caller agrees. */
  configured: boolean
  get: typeof S3Storage.get
  upload: typeof localStorage.upload
  copyObject: typeof S3Storage.copyObject
  deleteByPrefix: typeof S3Storage.deleteByPrefix
}

/**
 * Chosen once from the validated config, never from `process.env`. Read at call
 * time, so a script that forces the flag must set it in the environment before
 * this process starts — `config` is frozen at import.
 */
export const getMediaStore = (): MediaStore =>
  config.storage.local.enabled
    ? {
        configured: true,
        get: localStorage.get,
        upload: localStorage.upload,
        copyObject: localStorage.copyObject,
        deleteByPrefix: localStorage.deleteByPrefix
      }
    : {
        configured: Boolean(config.storage.s3.endpoint),
        get: S3Storage.get,
        upload: S3Storage.uploadFile,
        copyObject: S3Storage.copyObject,
        deleteByPrefix: S3Storage.deleteByPrefix
      }
