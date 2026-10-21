import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'

import { houseEnvelopeHook } from '../../http/envelope'
import { MEDIA_SESSION_PATH } from '../../lib/mediaSession'
import { documentIdParamSchema, mediaIdParamSchema } from '../../schemas/hypermultimedia.schema'
import * as documentsController from '../controllers/documents.controller'
import { requireUser } from '../middleware/auth'
import { MEDIA_MAX_FILE_SIZE } from '../services/media.service'

/**
 * One literal serves the mount, the media-read rate-limit bucket in
 * `middleware/index.ts` and the media cookie Path. It lives in `lib/mediaSession.ts`,
 * because the controller needs it, and the router imports the controller.
 */
export const HYPERMULTIMEDIA_MOUNT_PATH = MEDIA_SESSION_PATH

const hypermultimedia = new Hono()

// Reject oversize uploads before the controller buffers the whole multipart
// body into memory. Sized a little above the media cap to absorb multipart
// boundary/header overhead so a file exactly at the cap still reaches the
// friendly post-parse PayloadTooLargeError.
const uploadBodyLimit = bodyLimit({
  maxSize: MEDIA_MAX_FILE_SIZE + 1_048_576,
  onError: (c) =>
    c.json({ success: false, error: { message: 'File too large', code: 'PAYLOAD_TOO_LARGE' } }, 413)
})

// Before `POST /:documentId`: `session` passes `documentIdField`, so that route
// would claim it as a document id.
hypermultimedia.post('/session', requireUser, documentsController.createMediaSession)
hypermultimedia.delete('/session', documentsController.clearMediaSession)

// Public read for a public document. A Private one needs the media cookie.
hypermultimedia.get(
  '/:documentId/:mediaId',
  zValidator('param', mediaIdParamSchema, houseEnvelopeHook),
  documentsController.getMedia
)

// Upload is a write — require a verified Supabase user (token sent by the webapp).
hypermultimedia.post(
  '/:documentId',
  requireUser,
  uploadBodyLimit,
  zValidator('param', documentIdParamSchema, houseEnvelopeHook),
  documentsController.uploadMedia
)

export default hypermultimedia
