import expressRouter from '../utils/router.mjs'
import { PrismaClient } from '@prisma/client'
import ShortUniqueId from 'short-unique-id'
import slugify from 'slugify'
import * as validator from '../utils/routerValidator.mjs'
import { CREATE_DOCUMENT, UPDATE_DOCUMENT_METADATA } from './schema/documents.mjs'
import { createClient } from '@supabase/supabase-js'
import jwt_decode from 'jwt-decode'
import mime from 'mime'
import { v4 as uuidv4 } from 'uuid'
import { checkEnvBolean } from '../utils/index.mjs'
import * as localStorage from './storage/storage.local.mjs'
import * as AWSS3Storage from './storage/storage.AWS.S3.mjs'
import { extractFileType } from './storage/fileType.mjs'

const prisma = new PrismaClient()
const router = expressRouter()

const getOwnerProfile = async (userId) => {
  if (!process.env.SUPABASE_URL && !process.env.SUPABASE_ANON_KEY) return null
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return data ? data : null
}

const getOwnerProfiles = async (userIds) => {
  if (!process.env.SUPABASE_URL && !process.env.SUPABASE_ANON_KEY) return null
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  const { data } = await supabase.from('profiles').select('*').in('id', userIds)
  return data
}

const createNewDocument = async (slug, title, description = '', keywords = '', user) => {
  const newSlug = slugify(slug.toLowerCase(), { lower: true, strict: true })
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
  const docName = slugify(req.params.docName.toLowerCase(), { lower: true, strict: true })
  const { userId } = req.query
  const token = req.headers.token
  const user = token && userId ? { ...jwt_decode(token), id: userId } : null

  const doc = await prisma.documentMetadata.findUnique({
    where: {
      slug: docName
    }
  })

  if (doc === null) return createNewDocument(docName, null, null, null, user)
  if (doc.keywords)
    doc.keywords = doc.keywords.length === 0 ? [] : doc.keywords.split(',').map((k) => k.trim())

  const ownerProfile = doc.ownerId ? await getOwnerProfile(doc.ownerId) : null

  return { ...doc, ownerProfile }
})

router.get('/documents', async (req, res) => {
  const {
    title,
    keywords: reqKeywords,
    description,
    limit: reqLimit,
    offset: reqOffset
  } = req.query

  const limit = parseInt(reqLimit, 10) || 10 // Default limit is 10
  const offset = parseInt(reqOffset, 10) || 0 // Default offset is 0

  let documents
  let total

  if (title || reqKeywords || description) {
    let search = decodeURIComponent(title)
    let keywords = decodeURIComponent(reqKeywords)
    let desc = decodeURIComponent(description)

    // Tokenize each string
    let searchTokens = search.split(' ')
    let keywordTokens = keywords.split(' ')
    let descTokens = desc.split(' ')

    // Combine all tokens
    let allTokens = [...searchTokens, ...keywordTokens, ...descTokens]

    // Remove any empty tokens
    allTokens = allTokens.filter((x) => x && x !== 'undefined')

    // Join all tokens with ' & '
    let searchQuery = allTokens.join(' & ')

    let [docs, count] = await Promise.all([
      prisma.documentMetadata.findMany({
        skip: offset,
        take: limit,
        where: {
          OR: [
            { title: { contains: searchQuery } }, // I'll need to check if this is needed
            { title: { search: searchQuery } },
            { keywords: { search: searchQuery } },
            { description: { search: searchQuery } }
          ]
        }
      }),
      prisma.documentMetadata.count({
        where: {
          OR: [
            { title: { contains: searchQuery } }, // I'll need to check if this is needed
            { title: { search: searchQuery } },
            { keywords: { search: searchQuery } },
            { description: { search: searchQuery } }
          ]
        }
      })
    ])
    documents = docs
    total = count
  } else {
    // Document retrieval logic
    let [doclist, count] = await Promise.all([
      prisma.documentMetadata.findMany({
        skip: offset,
        take: limit
      }),
      prisma.documentMetadata.count()
    ])
    documents = doclist
    total = count
  }

  documents.forEach((doc) => {
    doc.keywords = doc.keywords.length === 0 ? [] : doc.keywords.split(',').map((k) => k.trim())
  })

  const userIds = documents.filter((doc) => doc.ownerId && doc.ownerId).map((doc) => doc.ownerId)

  // I need to check if has cookie token also
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    const ownerProfiles = await getOwnerProfiles(userIds)
    documents = documents.map((doc) => {
      const user = ownerProfiles?.find((profile) => profile.id === doc.ownerId)
      return { ...doc, user }
    })
  }

  return { docs: documents, total }
})

router.post('/documents', validator.body(CREATE_DOCUMENT), async (req, res) => {
  const { title, slug, description, keywords } = req.body

  return createNewDocument(slug, title, description, keywords)
})

router.put('/documents/:docId', validator.body(UPDATE_DOCUMENT_METADATA), async (req, res) => {
  const { docId } = req.params
  const { title, description, keywords, readOnly } = req.body
  const newMetaData = {
    where: {
      documentId: docId
    },
    data: {}
  }
  if (description) newMetaData.data.description = description
  if (title) newMetaData.data.title = title
  if (keywords) newMetaData.data.keywords = keywords.join(',')
  newMetaData.data.readOnly = readOnly

  const updatedDoc = await prisma.documentMetadata.update(newMetaData)
  updatedDoc.keywords =
    updatedDoc.keywords.length === 0 ? [] : updatedDoc.keywords.split(',').map((k) => k.trim())

  return updatedDoc
})

router.expressRouter.get('/plugins/hypermultimedia/:documentId/:mediaId', (req, res) => {
  const { documentId, mediaId } = req.params

  if (checkEnvBolean(process.env.PERSIST_TO_LOCAL_STORAGE)) {
    return localStorage.get(documentId, mediaId, res).catch((err) => {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.write(JSON.stringify(err.message))
      res.end()
    })
  }

  return AWSS3Storage.get(documentId, mediaId, res).catch((err) => {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.write(JSON.stringify(err.message))
    res.end()
  })
})

router.expressRouter.post('/plugins/hypermultimedia/:documentId', async (req, res) => {
  const documentId = req.params.documentId
  const files = req.files
  const mediaFile = files?.mediaFile
  const canPersist2Local = checkEnvBolean(process.env.PERSIST_TO_LOCAL_STORAGE) || false

  // TODO: check if the config is aviailable
  //if (!storageConfig) return

  if (!mediaFile) return res.status(400).send('No files were uploaded.')

  // if "persistToLocal" set true,   save the media to current directory
  if (canPersist2Local) {
    const uploadResult = await localStorage.upload(documentId, mediaFile).catch((err) => {
      console.error(err)
      return res.status(400).send('No files were uploaded.')
    })
    res.send({ ...uploadResult })
    return res.end()
  }

  // if s3 storage config available
  if (process.env.DO_STORAGE_ENDPOINT) {
    const format = mime.getExtension(mediaFile.mimetype)
    const fileName = `${uuidv4()}.${format}`
    const fileType = extractFileType(mediaFile.mimetype)
    const Key = `${documentId}/${fileName}`

    const data = await AWSS3Storage.upload(documentId, fileName, mediaFile.data).catch((err) => {
      console.error('AWS.S3 router:', err)
      return res.status(400).send('No files were uploaded.')
    })

    const result = { type: 's3', error: true, fileType, fileName, data: mediaFile.data }

    if (!data) {
      return res.status(400).json(result)
    }

    return res.status(201).json({ ...result, error: false, fileAddress: Key })
  }

  return req.send(true)
})

export default router.expressRouter
