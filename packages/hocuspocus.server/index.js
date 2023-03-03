import * as dotenvFlow from 'dotenv-flow'
import express from 'express'
import chalk from 'chalk'
import expressWebsockets from 'express-ws'
import { Server } from '@hocuspocus/server'
import HocuspocusConfig from './hocuspocus.config.mjs'
import { checkEnvBolean } from './utils/index.mjs'
import morgan from 'morgan'
import routers from './routers/router.mjs'
import middlewares from "./middlewares/index.mjs"

process.env.NODE_ENV = process.env.NODE_ENV || 'development'

// import Envirment value
dotenvFlow.config({
  purge_dotenv: true,
  node_env: process.env.NODE_ENV,
  silent: true
})

const {
  APP_PORT,
  NODE_ENV,
  HOCUSPOCUS_LOGGER,
  HOCUSPOCUS_THROTTLE,
  DATABASE_TYPE,
  DATABASE_URL,
  REDIS
} = process.env

const Serverconfigure = HocuspocusConfig()

// Configure hocuspocus
const server = Server.configure(Serverconfigure)

// Setup your express instance using the express-ws extension
const { app } = expressWebsockets(express())

// import morgan logger as  amiddlewares for rest api
app.use(morgan(`${ chalk.green(`[${ Serverconfigure.name }]`) } :method :url :status - :response-time ms`))

// A basic http route
app.get('/', (_request, response) => {
  response.send({ message: 'Hello World!' })
})

app.use(middlewares)
app.use('/api', routers)

app.ws('/echo', function (ws, _req) {
  ws.on('message', (msg) => ws.send(msg))
})

// Add a websocket route for hocuspocus
// Note: make sure to include a parameter for the document name.
// You can set any contextual data like in the onConnect hook
// and pass it to the handleConnection method.
app.ws('/collaboration/public/:documentId', (websocket, req) => {
  websocket.on('message', function (_msg) {
    // console.log("message", _msg.toString());
  })

  const context = {
    params: req.query,
    user: {
      id: 1234,
      name: 'Jane'
    }
  }
  // console.log('socket', context);

  console.log({ context, params: req.params })

  server.handleConnection(websocket, req, req.params.documentId, context)
})

// Start the server
app.listen(APP_PORT, () => {
  console.info(`
    Server "${ chalk.magentaBright(Serverconfigure.name) }" started. Port: ${ chalk.blue.bold(APP_PORT) } , NODE_ENV: ${ chalk.blue.bold(NODE_ENV) }
    Open Project: ${ chalk.bold.underline.yellow(`http://localhost:${ APP_PORT }`) } (ctrl+click)
    Config:
            REDIS: ${ chalk.blue.bold(checkEnvBolean(REDIS)) }
            Database: ${ chalk.blue.bold(DATABASE_TYPE) }
            DATABASE_URL: ${ chalk.blue.bold(DATABASE_URL) }
            HOCUSPOCUS_LOGGER: ${ chalk.blue.bold(checkEnvBolean(HOCUSPOCUS_LOGGER)) }
            HOCUSPOCUS_THROTTLE: ${ chalk.blue.bold(checkEnvBolean(HOCUSPOCUS_THROTTLE)) }
  `)
})
