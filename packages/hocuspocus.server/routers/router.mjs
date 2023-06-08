import expressRouter from '../utils/router.mjs'
import { PrismaClient } from '@prisma/client'
import slugify from 'slugify'
import * as validator from '../utils/routerValidator.mjs'
import { CREATE_DOCUMENT, UPDATE_DOCUMENT_METADATA } from './schema/documents.mjs'
import ShortUniqueId from 'short-unique-id'

const prisma = new PrismaClient()
const router = expressRouter()

const createNewDocument = async (slug, title, description) => {
  const newSlug = slugify(slug, { lower: true, strict: true })
  const uid = new ShortUniqueId()
  const documentId = uid.stamp(19)

  // First, create a new Document
  await prisma.document.create({
    data: {
      documentId,
      // Add any other necessary fields for Document
      data: Buffer.from([]) // for example
    }
  })

  const newDocumentMeta = {
    slug: newSlug,
    title: title || newSlug,
    description: description || newSlug,
    documentId
  }
  return prisma.documentMetadata.create({ data: newDocumentMeta })
}

router.get('/documents/:docName', async (req, res) => {
  const { docName } = req.params
  const doc = await prisma.documentMetadata.findUnique({
    where: {
      slug: docName
    }
  })

  if (doc === null) return createNewDocument(docName)

  return doc
})

router.get('/documents', (req, res) => {
  return prisma.documentMetadata.findMany()
})

router.post('/documents', validator.body(CREATE_DOCUMENT), async (req, res) => {
  const { title, slug, description } = req.body
  return createNewDocument(title, slug, description)
})

router.put('/documents/:docId', validator.body(UPDATE_DOCUMENT_METADATA), async (req, res) => {
  const { docId } = req.params
  const { title, description } = req.body
  const newMetaData = {
    where: {
      documentId: docId
    },
    data: {}
  }
  if (description) newMetaData.data.description = description
  if (title) newMetaData.data.title = title

  return prisma.documentMetadata.update(newMetaData)
})

export default router.expressRouter
