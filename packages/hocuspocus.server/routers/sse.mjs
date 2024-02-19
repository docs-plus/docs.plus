import express from 'express'
import SSE from '../utils/sse.mjs'
import Queue from 'bull'

const sse = new SSE()
const router = express.Router()

const BroadcastEvent = new Queue('broadcast event', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  },
  limiter: {
    max: 300,
    duration: 1000
  }
})

BroadcastEvent.process(async function (job, done) {
  const { data } = job
  const { eventId, data: eventData } = data

  try {
    await sse.send(eventId, eventData)
  } catch (err) {
    console.error('Error broadcasting event:', err)
  } finally {
    done()
  }
})

// SSE
router.get('/:action', (req, res) => {
  const { action } = req.params
  // get query params
  const { userId } = req.query
  res.supabaseUserId = userId || null

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  sse.addClient(action, { res })

  res.on('close', () => {
    console.info(`Client disconnected from event ${action}`)
    res.end()
  })
})

router.post('/:action', (req, res) => {
  const { action } = req.params
  const { body } = req

  if (!sse.clients[action]) {
    return res.status(404).send({ message: `Event ${action} not found!` })
  }

  if (!sse.clients[action].size) {
    return res.status(404).send({ message: `No clients connected to event ${action}!` })
  }

  if (!body) {
    return res.status(400).send({ message: 'Body is required!' })
  }

  if (body?.getClients) {
    const channelId = body?.channelId || null
    const userId = body?.userId || null

    req.body = {
      ...req.body,
      userPrecenses: Array.from(sse.clients[action]).map((client) => ({
        id: client.res.supabaseUserId,
        channelId: client.res.supabaseUserId === userId ? channelId : client.res.channelId
      }))
    }

    // remove getClients from body
    delete req.body.getClients
  }

  BroadcastEvent.add({ eventId: action, data: { action, body: req.body } })
  res.status(204).end()
})

export default router
