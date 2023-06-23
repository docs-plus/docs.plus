import expressRouter from '../utils/router.mjs'
import { PrismaClient } from '@prisma/client'
import ShortUniqueId from 'short-unique-id'
import slugify from 'slugify'
import * as validator from '../utils/routerValidator.mjs'
import { CREATE_DOCUMENT, UPDATE_DOCUMENT_METADATA } from './schema/documents.mjs'
import { createClient } from '@supabase/supabase-js'
import jwt_decode from 'jwt-decode'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
const prisma = new PrismaClient()
const router = expressRouter()

const getOwnerProfile = async (userId) => {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId)
  return data[0]
}

const createNewDocument = async (slug, title, description = '', keywords = '', user) => {
  const newSlug = slugify(slug, { lower: true, strict: true })
  const uid = new ShortUniqueId()
  const documentId = uid.stamp(19)
  const userId = user?.id

  const newDocumentMeta = {
    slug: newSlug,
    title: title || newSlug,
    description: description || newSlug,
    documentId,
    keywords: keywords ? keywords?.join(', ') : '',
    ownerId: userId,
    email: user?.email
  }
  const ownerProfile = userId ? await getOwnerProfile(userId) : null

  const doc = await prisma.documentMetadata.create({ data: newDocumentMeta })

  return { ...doc, ownerProfile }
}

router.get('/documents/:docName', async (req, res) => {
  const { docName } = req.params
  const { userId } = req.query
  const token = req.headers.token
  const user = token ? { ...jwt_decode(token), id: userId } : null

  const doc = await prisma.documentMetadata.findUnique({
    where: {
      slug: docName
    }
  })

  if (doc === null) return createNewDocument(docName, null, null, null, user)
  if (doc.keywords) doc.keywords = doc.keywords.length === 0 ? [] : doc.keywords.split(',').map((k) => k.trim())

  const ownerProfile = doc.ownerId ? await getOwnerProfile(doc.ownerId) : null

  return { ...doc, ownerProfile }
})

router.get('/documents', async (req, res) => {
  const doclist = await prisma.documentMetadata.findMany()
  doclist.forEach((doc) => {
    doc.keywords = doc.keywords.length === 0 ? [] : doc.keywords.split(',').map((k) => k.trim())
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
  updatedDoc.keywords = updatedDoc.keywords.length === 0 ? [] : updatedDoc.keywords.split(',').map((k) => k.trim())

  return updatedDoc
})

export default router.expressRouter
