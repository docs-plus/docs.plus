import dotenvFlow from 'dotenv-flow'
import { Hocuspocus } from '@hocuspocus/server'
import HocuspocusConfig, { prisma } from './hocuspocus.config.mjs'

process.env.NODE_ENV = process.env.NODE_ENV || 'development'

dotenvFlow.config({
  purge_dotenv: true,
  node_env: process.env.NODE_ENV,
  silent: true
})
const Serverconfigure = HocuspocusConfig()

// Configure the server …
const server = new Hocuspocus(Serverconfigure)

async function handleHistoryEvents(payload, context, document) {
  const { type, documentId } = payload

  switch (type) {
    case 'history.list': {
      const docs = await prisma.documents.findMany({
        where: { documentId },
        orderBy: { createdAt: 'desc' },
        select: { version: true, commitMessage: true, createdAt: true }
      })

      return docs
    }

    case 'history.watch': {
      const doc = await prisma.documents.findFirst({
        where: { documentId, version: payload.version },
        select: { data: true, version: true, commitMessage: true, createdAt: true }
      })

      if (!doc) return null

      // Convert Buffer to Base64 string for transport
      return {
        data: Buffer.from(doc.data).toString('base64'),
        version: doc.version,
        commitMessage: doc.commitMessage,
        createdAt: doc.createdAt
      }
    }

    case 'history.prev':
      return prisma.documents.findFirst({
        where: { documentId, version: { lt: payload.currentVersion } },
        orderBy: { version: 'desc' }
      })

    case 'history.next':
      return prisma.documents.findFirst({
        where: { documentId, version: { gt: payload.currentVersion } },
        orderBy: { version: 'asc' }
      })

    default:
      return payload
  }
}

const broadcastToAll = (document, payload) => {
  document.broadcastStateless(JSON.stringify(payload))
}

const broadcastToAllExceptCurrent = (document, payload, connection) => {
  document.broadcastStateless(JSON.stringify(payload), (con) => {
    return con.socketId !== connection.socketId
  })
}

const statelessExtension = {
  async onStateless({ payload, context, document, connection }) {
    payload = JSON.parse(payload)
    if (payload.msg === 'history') {
      try {
        const response = await handleHistoryEvents(payload, context, document)
        if (payload.type === 'history.revert') {
          broadcastToAll(document, { msg: 'history.response', type: payload.type, response })
        } else {
          broadcastToAll(document, { msg: 'history.response', type: payload.type, response })
        }
      } catch (error) {
        console.error('Error handling history event:', error)
      }
    } else {
      document.broadcastStateless(payload)
    }
  }
}

// after creating the server
server.configure({
  extensions: [...server.configuration.extensions, statelessExtension]
})

// … and run it!
server.listen()
