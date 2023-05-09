import * as dotenvFlow from 'dotenv-flow'
import express from 'express'
import chalk from 'chalk'
import { checkEnvBolean } from './utils/index.mjs'
import routers from './routers/router.mjs'
import middlewares from './middlewares/index.mjs'

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

const app = express()

// A basic http route
app.get('/', (_request, response) => {
  response.send({ message: 'Hello World!' })
})

app.use(middlewares)
app.use('/api', routers)

// Start the server
app.listen(APP_PORT, () => {
  console.info(`
    Server "===" started. Port: ${chalk.blue.bold(APP_PORT)} , NODE_ENV: ${chalk.blue.bold(NODE_ENV)}
    Open Project: ${chalk.bold.underline.yellow(`http://localhost:${APP_PORT}`)} (ctrl+click)
    Config:
            REDIS: ${chalk.blue.bold(checkEnvBolean(REDIS))}
            Database: ${chalk.blue.bold(DATABASE_TYPE)}
            DATABASE_URL: ${chalk.blue.bold(DATABASE_URL)}
            HOCUSPOCUS_LOGGER: ${chalk.blue.bold(checkEnvBolean(HOCUSPOCUS_LOGGER))}
            HOCUSPOCUS_THROTTLE: ${chalk.blue.bold(checkEnvBolean(HOCUSPOCUS_THROTTLE))}
  `)
})
