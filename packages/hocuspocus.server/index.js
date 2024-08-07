import dotenvFlow from 'dotenv-flow'
import express from 'express'
import chalk from 'chalk'
import { checkEnvBolean } from './utils/index.mjs'
import routers from './routers/router.mjs'
import middlewares from './middlewares/index.mjs'
// import sseRouters from './routers/sse.mjs' // INFO: depricated

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
// app.use('/sse', sseRouters) // INFO: depricated

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
