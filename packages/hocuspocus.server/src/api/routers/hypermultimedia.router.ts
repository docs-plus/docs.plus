import { Hono } from 'hono'

import * as documentsController from '../controllers/documents.controller'

const hypermultimedia = new Hono()

// Get media file
hypermultimedia.get('/:documentId/:mediaId', documentsController.getMedia)

// Upload media file
hypermultimedia.post('/:documentId', documentsController.uploadMedia)

export default hypermultimedia
