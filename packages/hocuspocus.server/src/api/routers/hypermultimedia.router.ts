import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { documentIdParamSchema, mediaIdParamSchema } from '../../schemas/hypermultimedia.schema'
import * as documentsController from '../controllers/documents.controller'

const hypermultimedia = new Hono()

// Get media file
hypermultimedia.get(
  '/:documentId/:mediaId',
  zValidator('param', mediaIdParamSchema),
  documentsController.getMedia
)

// Upload media file
hypermultimedia.post(
  '/:documentId',
  zValidator('param', documentIdParamSchema),
  documentsController.uploadMedia
)

export default hypermultimedia
