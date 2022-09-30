import { PrismaClient } from '@prisma/client'
import { checkEnvBolean } from './utils.mjs'
import cryptoRandomString from 'crypto-random-string'
import { Database } from '@hocuspocus/extension-database'
import { SQLite } from '@hocuspocus/extension-sqlite'

import { Throttle } from '@hocuspocus/extension-throttle'
import { Redis } from '@hocuspocus/extension-redis'
import { Logger } from '@hocuspocus/extension-logger'


export default () => {

  const {
    APP_NAME,
    HOCUSPOCUS_LOGGER,
    HOCUSPOCUS_THROTTLE,
    HOCUSPOCUS_THROTTLE_ATTEMPTS,
    HOCUSPOCUS_THROTTLE_BANTIME,
    HOCUSPOCUS_LOGGER_ON_LOAD_DOCUMENT,
    HOCUSPOCUS_LOGGER_ON_CHANGE,
    HOCUSPOCUS_LOGGER_ON_CONNECT,
    HOCUSPOCUS_LOGGER_ON_DISCONNECT,
    HOCUSPOCUS_LOGGER_ON_UPGRADE,
    HOCUSPOCUS_LOGGER_ON_REQUEST,
    HOCUSPOCUS_LOGGER_ON_LISTEN,
    HOCUSPOCUS_LOGGER_ON_DESTROY,
    HOCUSPOCUS_LOGGER_ON_CONFIGURE,
    DATABASE_TYPE,
    REDIS,
    REDIS_HOST,
    REDIS_PORT

  } = process.env

  const prisma = new PrismaClient()

  const Serverconfigure = {
    name: `${ APP_NAME }_${ cryptoRandomString({ length: 4, type: 'alphanumeric' }) }`,
    extensions: []
  }

  console.log(DATABASE_TYPE)


  if (checkEnvBolean(HOCUSPOCUS_THROTTLE)) {
    const throttle = new Throttle({
      // [optional] allows up to 15 connection attempts per ip address per minute.
      // set to null or false to disable throttling, defaults to 15
      throttle: +HOCUSPOCUS_THROTTLE_ATTEMPTS,

      // [optional] bans ip addresses for 5 minutes after reaching the threshold
      // defaults to 5
      banTime: +HOCUSPOCUS_THROTTLE_BANTIME
    })
    Serverconfigure.extensions.push(throttle)
  }

  if (checkEnvBolean(HOCUSPOCUS_LOGGER)) {
    const logger = new Logger({
      onLoadDocument: checkEnvBolean(HOCUSPOCUS_LOGGER_ON_LOAD_DOCUMENT),
      onChange: checkEnvBolean(HOCUSPOCUS_LOGGER_ON_CHANGE),
      onConnect: checkEnvBolean(HOCUSPOCUS_LOGGER_ON_CONNECT),
      onDisconnect: checkEnvBolean(HOCUSPOCUS_LOGGER_ON_DISCONNECT),
      onUpgrade: checkEnvBolean(HOCUSPOCUS_LOGGER_ON_UPGRADE),
      onRequest: checkEnvBolean(HOCUSPOCUS_LOGGER_ON_REQUEST),
      onListen: checkEnvBolean(HOCUSPOCUS_LOGGER_ON_LISTEN),
      onDestroy: checkEnvBolean(HOCUSPOCUS_LOGGER_ON_DESTROY),
      onConfigure: checkEnvBolean(HOCUSPOCUS_LOGGER_ON_CONFIGURE)
    })
    Serverconfigure.extensions.push(logger)
  }

  if (checkEnvBolean(REDIS)) {
    const redis = new Redis({
      // [required] Hostname of your Redis instance
      host: REDIS_HOST,

      // [required] Port of your Redis instance
      port: +REDIS_PORT
    })
    Serverconfigure.extensions.push(redis)
  }

  if (DATABASE_TYPE === 'SQLite') {
    const database = new SQLite({ database: 'db.sqlite' })
    Serverconfigure.extensions.push(database)
  }

  if (DATABASE_TYPE === 'PostgreSQL') {
    const database = new Database({
      // Return a Promise to retrieve data …
      fetch: async ({ documentName }) => {
        console.log("")
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
          // process.exit(1)
        })

        console.log(doc, "documentName")


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
          // process.exit(1)
        })
      }
    })

    Serverconfigure.extensions.push(database)
  }

  return Serverconfigure
}
