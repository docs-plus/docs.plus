import dotenvFlow from 'dotenv-flow'
import express from 'express'
import chalk from 'chalk'
import { checkEnvBolean } from './utils/index.mjs'
import routers from './routers/router.mjs'
import middlewares from './middlewares/index.mjs'
import SSE from './utils/sse.mjs'

const sse = new SSE()

process.env.NODE_ENV = process.env.NODE_ENV || 'development'

// import Envirment value
dotenvFlow.config({
  purge_dotenv: true,
  node_env: process.env.NODE_ENV,
  silent: true
})

const { APP_PORT, NODE_ENV, HOCUSPOCUS_LOGGER, HOCUSPOCUS_THROTTLE, DATABASE_URL } = process.env

const app = express()

// A basic http route
app.get('/', (_request, response) => {
  response.send({ message: 'Hello World!' })
})

app.use(middlewares())
app.use('/api', routers)

// SSE
app.get('/sse/:action', (req, res) => {
  const { action } = req.params

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

app.post('/sse/:action', (req, res) => {
  const { action } = req.params

  if (!sse.clients[action]) {
    return res.status(404).send({ message: `Event ${action} not found!` })
  }

  if (!sse.clients[action].length) {
    return res.status(404).send({ message: `No clients connected to event ${action}!` })
  }

  sse.send(action, { action, body: req.body })
  res.status(204).end()
})

// Start the server
app.listen(APP_PORT, () => {
  console.info(`
    Server started. Port: ${chalk.blue.bold(APP_PORT)} , NODE_ENV: ${chalk.blue.bold(NODE_ENV)}
    Open Project: ${chalk.bold.underline.yellow(`http://localhost:${APP_PORT}`)} (ctrl+click)
    Config:
          HOCUSPOCUS_LOGGER: ${chalk.blue.bold(checkEnvBolean(HOCUSPOCUS_LOGGER))}
          HOCUSPOCUS_THROTTLE: ${chalk.blue.bold(checkEnvBolean(HOCUSPOCUS_THROTTLE))}
          DATABASE_URL: ${chalk.blue.bold(DATABASE_URL)}
  `)
})
