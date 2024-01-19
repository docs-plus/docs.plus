import * as Y from 'yjs'
import cryptoRandomString from 'crypto-random-string'

import { PrismaClient } from '@prisma/client'
import { generateJSON } from '@tiptap/html'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { TiptapTransformer } from '@hocuspocus/transformer'
import { Database } from '@hocuspocus/extension-database'
import { Throttle } from '@hocuspocus/extension-throttle'
import { Redis } from '@hocuspocus/extension-redis'
import { Logger } from '@hocuspocus/extension-logger'

import { checkEnvBolean } from './utils/index.mjs'

import Queue from 'bull'

const StoreDocument = new Queue('store documents changes', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  },
  limiter: {
    max: 300,
    duration: 1000
  }
})

StoreDocument.process(async function (job, done) {
  const { data } = job
  try {
    console.time(`Store Data, jobId:${job.id}`)

    return await prisma.documents.create({
      data: {
        documentId: data.documentName,
        data: Buffer.from(data.state, 'base64')
        // collaborators: {
        //   create: {
        //     userId: id,
        //     email: email
        //   }
        // }
      }
    })
  } catch (err) {
    console.error('Error storing data:', err)
  } finally {
    console.timeEnd(`Store Data, jobId:${job.id}`)
    done()
  }
})

const prisma = new PrismaClient()

const getServerName = () =>
  `${process.env.APP_NAME}_${cryptoRandomString({
    length: 4,
    type: 'alphanumeric'
  })}`

const generateDefaultState = () => {
  const html = `<h1>&shy;</h1>
  <p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>
  <p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>
  <p></p><p></p><p></p><p></p><p></p><p></p><p></p><p></p>
  `

  const json = generateJSON(html, [Document, Paragraph, Text])

  const defaultDoc = TiptapTransformer.toYdoc(json)

  return Y.encodeStateAsUpdate(defaultDoc)
}

const configureExtensions = () => {
  const extensions = []

  if (checkEnvBolean(process.env.HOCUSPOCUS_THROTTLE)) {
    extensions.push(
      new Throttle({
        throttle: +process.env.HOCUSPOCUS_THROTTLE_ATTEMPTS,
        banTime: +process.env.HOCUSPOCUS_THROTTLE_BANTIME
      })
    )
  }

  if (checkEnvBolean(process.env.HOCUSPOCUS_LOGGER)) {
    extensions.push(
      new Logger({
        onLoadDocument: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_LOAD_DOCUMENT),
        onChange: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_CHANGE),
        onConnect: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_CONNECT),
        onDisconnect: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_DISCONNECT),
        onUpgrade: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_UPGRADE),
        onRequest: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_REQUEST),
        onListen: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_LISTEN),
        onDestroy: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_DESTROY),
        onConfigure: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_CONFIGURE)
      })
    )
  }

  if (process.env.NODE_ENV === 'production' && checkEnvBolean(process.env.REDIS)) {
    extensions.push(
      new Redis({
        host: process.env.REDIS_HOST,
        port: +process.env.REDIS_PORT
      })
    )
  }

  extensions.push(
    new Database({
      fetch: async ({ documentName, context }) => {
        try {
          const doc = await prisma.documents.findMany({
            take: 1,
            where: { documentId: documentName },
            orderBy: { id: 'desc' }
          })

          return doc[0]?.data || generateDefaultState()
        } catch (err) {
          console.error('Error fetching data:', err)
          await prisma.$disconnect()
          throw err
        }
      },
      store: async (data) => {
        const { documentName, state, context } = data
        // console.log(data.requestHeaders.cookie.split(';')[0].split('=')[1])
        StoreDocument.add({
          documentName,
          state: state.toString('base64'),
          context,
          email: data.requestParameters.get('email'),
          userId: data.requestParameters.get('userId'),
          jwt: data.requestHeaders.cookie?.split(';')[0].split('=')[1]
        })
      }
    })
  )

  return extensions
}

export default () => {
  return {
    name: getServerName(),
    port: process.env.HOCUSPOCUS_PORT,
    extensions: configureExtensions(),
    debounce: 1000,
    async onStateless({ payload, document, connection }) {
      document.broadcastStateless(payload)
    }
  }
}
