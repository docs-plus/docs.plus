import expressRouter from '../utils/router.mjs'
import { PrismaClient } from '@prisma/client'
import slugify from 'slugify'
import * as validator from '../utils/routerValidator.mjs'
import { CREATE_DOCUMENT, UPDATE_DOCUMENT_METADATA } from './schema/documents.mjs'
import ShortUniqueId from 'short-unique-id'

const prisma = new PrismaClient()
const router = expressRouter()

const createNewDocument = async (slug, title, description = '', keywords = '') => {
  const newSlug = slugify(slug, { lower: true, strict: true })
  const uid = new ShortUniqueId()
  const documentId = uid.stamp(19)

  const newDocumentMeta = {
    slug: newSlug,
    title: title || newSlug,
    description: description || newSlug,
    documentId,
    keywords: keywords && keywords?.join(', ')
  }
  const metadata = await prisma.documentMetadata.create({ data: newDocumentMeta })

  await prisma.documents.create({
    data: {
      documentId,
      data: Buffer.from([])
    }
  })

  return metadata
}

router.get('/documents/:docName', async (req, res) => {
  const { docName } = req.params
  const doc = await prisma.documentMetadata.findUnique({
    where: {
      slug: docName
    }
  })

  if (doc === null) return createNewDocument(docName)
  doc.keywords = doc.keywords.split(',').map((k) => k.trim())

  return doc
})

router.get('/documents', async (req, res) => {
  const doclist = await prisma.documentMetadata.findMany()
  doclist.forEach((doc) => {
    doc.keywords = doc.keywords.split(',').map((k) => k.trim())
  })
  return doclist
})

router.post('/documents', validator.body(CREATE_DOCUMENT), async (req, res) => {
  const { title, slug, description, keywords } = req.body

  return createNewDocument(slug, title, description, keywords)
})

router.put('/documents/:docId', validator.body(UPDATE_DOCUMENT_METADATA), async (req, res) => {
  const { docId } = req.params
  const { title, description, keywords } = req.body
  const newMetaData = {
    where: {
      documentId: docId
    },
    data: {}
  }
  if (description) newMetaData.data.description = description
  if (title) newMetaData.data.title = title
  if (keywords) newMetaData.data.keywords = keywords.join(',')

  const updatedDoc = await prisma.documentMetadata.update(newMetaData)
  updatedDoc.keywords = updatedDoc.keywords.split(',').map((k) => k.trim())

  return updatedDoc
})

export default router.expressRouter
