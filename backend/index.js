import * as dotenvFlow from 'dotenv-flow'

import express from 'express'
import chalk from 'chalk'
import expressWebsockets from 'express-ws'
import { Server } from '@hocuspocus/server'
import { Database } from '@hocuspocus/extension-database'
// import { SQLite } from '@hocuspocus/extension-sqlite'

import { Throttle } from '@hocuspocus/extension-throttle'
import { Redis } from '@hocuspocus/extension-redis'
import { Logger } from '@hocuspocus/extension-logger'
import cryptoRandomString from 'crypto-random-string'
// import mongoose from 'mongoose'
// import pkg from 'pg'

import { PrismaClient } from '@prisma/client'
import { checkEnvBolean, checkEnvNull } from './utils.mjs'

process.env.NODE_ENV = process.env.NODE_ENV || 'development'

// const { Pool } = pkg
// import Envirment value
dotenvFlow.config({
  purge_dotenv: true,
  node_env: process.env.NODE_ENV,
  silent: true
})

const {
  APP_PORT,
  NODE_ENV,
  APP_NAME,
  HOCUSPOCUS_EXT_LOGGER,
  HOCUSPOCUS_EXT_THROTTLE,
  HOCUSPOCUS_EXT_THROTTLE_ATTEMPTS,
  HOCUSPOCUS_EXT_THROTTLE_BANTIME,
  HOCUSPOCUS_EXT_REDIS,
  HOCUSPOCUS_EXT_REDIS_HOST,
  HOCUSPOCUS_EXT_REDIS_PORT,
  HOCUSPOCUS_EXT_LOGGER_onLoadDocument,
  HOCUSPOCUS_EXT_LOGGER_onChange,
  HOCUSPOCUS_EXT_LOGGER_onConnect,
  HOCUSPOCUS_EXT_LOGGER_onDisconnect,
  HOCUSPOCUS_EXT_LOGGER_onUpgrade,
  HOCUSPOCUS_EXT_LOGGER_onRequest,
  HOCUSPOCUS_EXT_LOGGER_onListen,
  HOCUSPOCUS_EXT_LOGGER_onDestroy,
  HOCUSPOCUS_EXT_LOGGER_onConfigure,
  HOCUSPOCUS_EXT_DB_TYPE,
  HOCUSPOCUS_EXT_DB_HOST,
  HOCUSPOCUS_EXT_DB_PORT,
  HOCUSPOCUS_EXT_DB_USER,
  HOCUSPOCUS_EXT_DB_PASS,
  HOCUSPOCUS_EXT_DB_NAME,
  HOCUSPOCUS_EXT_DB_CONNECTIONSTRING,
  HOCUSPOCUS_EXT_DB_OPTIONS
} = process.env

const Serverconfigure = {
  name: `${APP_NAME}_${cryptoRandomString({ length: 4, type: 'alphanumeric' })}`,
  extensions: []
}

if (checkEnvBolean(HOCUSPOCUS_EXT_THROTTLE)) {
  const throttle = new Throttle({
    // [optional] allows up to 15 connection attempts per ip address per minute.
    // set to null or false to disable throttling, defaults to 15
    throttle: +HOCUSPOCUS_EXT_THROTTLE_ATTEMPTS,

    // [optional] bans ip addresses for 5 minutes after reaching the threshold
    // defaults to 5
    banTime: +HOCUSPOCUS_EXT_THROTTLE_BANTIME
  })
  Serverconfigure.extensions.push(throttle)
}

if (checkEnvBolean(HOCUSPOCUS_EXT_LOGGER)) {
  const logger = new Logger({
    onLoadDocument: checkEnvBolean(HOCUSPOCUS_EXT_LOGGER_onLoadDocument),
    onChange: checkEnvBolean(HOCUSPOCUS_EXT_LOGGER_onChange),
    onConnect: checkEnvBolean(HOCUSPOCUS_EXT_LOGGER_onConnect),
    onDisconnect: checkEnvBolean(HOCUSPOCUS_EXT_LOGGER_onDisconnect),
    onUpgrade: checkEnvBolean(HOCUSPOCUS_EXT_LOGGER_onUpgrade),
    onRequest: checkEnvBolean(HOCUSPOCUS_EXT_LOGGER_onRequest),
    onListen: checkEnvBolean(HOCUSPOCUS_EXT_LOGGER_onListen),
    onDestroy: checkEnvBolean(HOCUSPOCUS_EXT_LOGGER_onDestroy),
    onConfigure: checkEnvBolean(HOCUSPOCUS_EXT_LOGGER_onConfigure)
  })
  Serverconfigure.extensions.push(logger)
}

if (checkEnvBolean(HOCUSPOCUS_EXT_REDIS)) {
  const redis = new Redis({
    // [required] Hostname of your Redis instance
    host: HOCUSPOCUS_EXT_REDIS_HOST,

    // [required] Port of your Redis instance
    port: +HOCUSPOCUS_EXT_REDIS_PORT
  })
  Serverconfigure.extensions.push(redis)
}

// if (HOCUSPOCUS_EXT_DB_TYPE === 'SQLite') {
//   const database = new SQLite({ database: 'db.sqlite' })
//   Serverconfigure.extensions.push(database)
// }

// if (HOCUSPOCUS_EXT_DB_TYPE === 'MongoDB') {
//   let connectionString = `mongodb://${HOCUSPOCUS_EXT_DB_HOST}:${HOCUSPOCUS_EXT_DB_PORT}/${HOCUSPOCUS_EXT_DB_NAME}`
//   if (HOCUSPOCUS_EXT_DB_USER && HOCUSPOCUS_EXT_DB_PASS) {
//     connectionString = `mongodb://${encodeURIComponent(HOCUSPOCUS_EXT_DB_USER)}:${encodeURIComponent(HOCUSPOCUS_EXT_DB_PASS)}@${HOCUSPOCUS_EXT_DB_HOST}:${HOCUSPOCUS_EXT_DB_PORT}/${HOCUSPOCUS_EXT_DB_NAME}`
//   }

//   if (checkEnvNull(HOCUSPOCUS_EXT_DB_OPTIONS)) { connectionString = `${connectionString}/?${HOCUSPOCUS_EXT_DB_OPTIONS}` }

//   if (checkEnvNull(HOCUSPOCUS_EXT_DB_CONNECTIONSTRING)) { connectionString = HOCUSPOCUS_EXT_DB_CONNECTIONSTRING }

//   console.log(connectionString)

//   await mongoose.connect(connectionString)
//   const Schema = mongoose.Schema
//   const DocumentSchema = new Schema({
//     name: String,
//     data: String,
//     date: { type: Date, default: Date.now }
//   })
//   const Document = mongoose.model('documents', DocumentSchema)

//   const database = new Database({
//     // Return a Promise to retrieve data …
//     fetch: async ({ documentName }) => {
//       const document = await Document.findOne({ name: documentName }).lean()
//       return document
//     },
//     // … and a Promise to store data:
//     store: async ({ documentName, state }) => {
//       const document = new Document()
//       document.name = documentName
//       document.data = state
//       await document.save()
//     }
//   })

//   Serverconfigure.extensions.push(database)
// }

if (HOCUSPOCUS_EXT_DB_TYPE === 'PostgreSQL') {
  // const Docuemnt = new Pool({
  //   host: HOCUSPOCUS_EXT_DB_HOST,
  //   user: HOCUSPOCUS_EXT_DB_USER,
  //   password: HOCUSPOCUS_EXT_DB_PASS,
  //   database: HOCUSPOCUS_EXT_DB_NAME,
  //   port: +HOCUSPOCUS_EXT_DB_PORT
  // })

  const prisma = new PrismaClient()

  // let connectionString = `mongodb://${HOCUSPOCUS_EXT_DB_HOST}:${HOCUSPOCUS_EXT_DB_PORT}/${HOCUSPOCUS_EXT_DB_NAME}`
  // if (HOCUSPOCUS_EXT_DB_USER && HOCUSPOCUS_EXT_DB_PASS) {
  //   connectionString = `mongodb://${encodeURIComponent(HOCUSPOCUS_EXT_DB_USER)}:${encodeURIComponent(HOCUSPOCUS_EXT_DB_PASS)}@${HOCUSPOCUS_EXT_DB_HOST}:${HOCUSPOCUS_EXT_DB_PORT}/${HOCUSPOCUS_EXT_DB_NAME}`
  // }

  // if (checkEnvNull(HOCUSPOCUS_EXT_DB_OPTIONS)) { connectionString = `${connectionString}/?${HOCUSPOCUS_EXT_DB_OPTIONS}` }
  // if (checkEnvNull(HOCUSPOCUS_EXT_DB_CONNECTIONSTRING)) { connectionString = HOCUSPOCUS_EXT_DB_CONNECTIONSTRING }

  const database = new Database({
    // Return a Promise to retrieve data …
    fetch: async ({ documentName }) => {
      const doc = await prisma.documents.findMany({
        take: 1,
        where: {
          name: documentName
        },
        orderBy: {
          id: 'desc'
        }
      }).catch(async err => {
        console.log('eeroroor', err)
        await prisma.$disconnect()
        process.exit(1)
      })

      console.log(doc)

      return doc[0]?.data
    },
    // … and a Promise to store data:
    store: async ({ documentName, state }) => {
      prisma.documents.create({
        data: {
          name: documentName,
          data: state
        }
      }).catch(async _err => {
        console.log('eeroroor', _err)
        await prisma.$disconnect()
        process.exit(1)
      })
    }
  })

  Serverconfigure.extensions.push(database)
}

// Configure hocuspocus
const server = Server.configure(Serverconfigure)

// Setup your express instance using the express-ws extension
const { app } = expressWebsockets(express())

// A basic http route
app.get('/', (_request, response) => {
  response.send('Hello World!')
})
app.get('/test', (_request, response) => {
  response.send('Hello World!')
})

app.ws('/echo', function (ws, _req) {
  ws.on('message', function (msg) {
    ws.send(msg)
  })
})

// Add a websocket route for hocuspocus
// Note: make sure to include a parameter for the document name.
// You can set any contextual data like in the onConnect hook
// and pass it to the handleConnection method.
app.ws('/collaboration/:document', (websocket, request) => {
  websocket.on('message', function (_msg) {
    // console.log("message", msg.toString());
  })

  const context = {
    user: {
      id: 1234,
      name: 'Jane'
    }
  }
  // console.log('socket', context);

  server.handleConnection(websocket, request, request.params.document, context)
})

// Start the server

app.listen(APP_PORT, () => {
  console.info(`
    Server "${chalk.magentaBright(Serverconfigure.name)}" started. Port: ${chalk.blue.bold(APP_PORT)} , NODE_ENV: ${chalk.blue.bold(NODE_ENV)}, Database: ${chalk.blue.bold(HOCUSPOCUS_EXT_DB_TYPE)}
    Open Project: ${chalk.bold.underline.yellow(`http://localhost:${APP_PORT}`)} (ctrl+click)
  `)
})
