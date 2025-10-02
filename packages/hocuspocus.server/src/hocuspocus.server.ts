import dotenvFlow from 'dotenv-flow'
import { Server } from '@hocuspocus/server'
import HocuspocusConfig, { prisma } from './config/hocuspocus.config'
import { jwtDecode } from 'jwt-decode'

process.env.NODE_ENV = process.env.NODE_ENV || 'development'

dotenvFlow.config({
  purge_dotenv: true,
  node_env: process.env.NODE_ENV,
  silent: true
})

interface HistoryPayload {
  type: string
  documentId: string
  version?: number
  currentVersion?: number
  msg?: string
}

async function handleHistoryEvents(payload: HistoryPayload, context: any, document: any) {
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
        where: { documentId, version: { lt: payload.currentVersion || 0 } },
        orderBy: { version: 'desc' }
      })

    case 'history.next':
      return prisma.documents.findFirst({
        where: { documentId, version: { gt: payload.currentVersion || 0 } },
        orderBy: { version: 'asc' }
      })

    default:
      return payload
  }
}

const broadcastToAll = (document: any, payload: any) => {
  document.broadcastStateless(JSON.stringify(payload))
}

const statelessExtension = {
  async onStateless({ payload, context, document, connection }: any) {
    const parsedPayload = JSON.parse(payload)

    if (parsedPayload.msg === 'history') {
      try {
        const response = await handleHistoryEvents(parsedPayload, context, document)
        broadcastToAll(document, {
          msg: 'history.response',
          type: parsedPayload.type,
          response
        })
      } catch (error) {
        console.error('Error handling history event:', error)
      }
    } else {
      document.broadcastStateless(JSON.stringify(parsedPayload))
    }
  }
}

// Get the base configuration and add our stateless extension
const baseConfig = HocuspocusConfig()
const serverConfig = {
  ...baseConfig,
  extensions: [...baseConfig.extensions, statelessExtension],

  async onAuthenticate({ token, documentName }: any) {
    if (!token) {
      console.info('No token provided')
      return {
        user: null,
        slug: '',
        documentId: documentName
      }
    }

    try {
      const newToken = JSON.parse(token)

      // Verify and decode JWT
      const decoded = jwtDecode(newToken.accessToken)

      // Return user data - this will be available in context throughout
      return {
        user: decoded,
        slug: newToken.slug,
        documentId: documentName
      }
    } catch (error) {
      console.error('JWT verification failed:', error instanceof Error ? error.message : error)

      try {
        const fallbackToken = JSON.parse(token)
        return {
          user: null,
          slug: fallbackToken.slug || '',
          documentId: documentName
        }
      } catch {
        return {
          user: null,
          slug: '',
          documentId: documentName
        }
      }
    }
  }
}

// Configure and start the server
const server = new Server(serverConfig)

// Start listening
server.listen()

console.log(`🚀 Hocuspocus WebSocket Server running on port ${baseConfig.port}`)

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down Hocuspocus server...')
  await server.destroy()
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down Hocuspocus server...')
  await server.destroy()
  await prisma.$disconnect()
  process.exit(0)
})
