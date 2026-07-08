import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'

import { documentIdParamSchema, mediaIdParamSchema } from '../../schemas/hypermultimedia.schema'
import * as documentsController from '../controllers/documents.controller'
import { requireUser } from '../middleware/auth'
import { MEDIA_MAX_FILE_SIZE } from '../services/media.service'

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

// Public read: media renders inside public documents for anonymous viewers.
hypermultimedia.get(
  '/:documentId/:mediaId',
  zValidator('param', mediaIdParamSchema),
  documentsController.getMedia
)

// Upload is a write — require a verified Supabase user (token sent by the webapp).
hypermultimedia.post(
  '/:documentId',
  requireUser,
  uploadBodyLimit,
  zValidator('param', documentIdParamSchema),
  documentsController.uploadMedia
)

export default hypermultimedia
