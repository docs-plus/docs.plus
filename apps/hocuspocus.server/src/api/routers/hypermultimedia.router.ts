import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { documentIdParamSchema, mediaIdParamSchema } from '../../schemas/hypermultimedia.schema'
import * as documentsController from '../controllers/documents.controller'
import { requireUser } from '../middleware/auth'

const hypermultimedia = new Hono()

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
  zValidator('param', documentIdParamSchema),
  documentsController.uploadMedia
)

export default hypermultimedia
