const path = require('path')
const dotEnvPath = path.resolve(__dirname, '../')
require('dotenv-flow').config({
  silent: true,
  path: dotEnvPath
})
const http = require('http')
const { Server } = require('socket.io')
const redisAdapter = require('socket.io-redis')
const Settings = require('../settings.json')
const { validateSettings, healthCheckRouter, forkComponents, redisCheckConnection } = require('./common')
const { PORT, HOST, REDIS_URL, REDIS_PORT } = process.env

redisCheckConnection()
validateSettings(Settings)

const httpServer = http.createServer(healthCheckRouter)
const io = new Server(httpServer)

io.adapter(redisAdapter({
  host: REDIS_URL,
  port: REDIS_PORT
}))

forkComponents(Settings, io)

httpServer.listen(PORT, () => {
  console.info(`Websocket gateway running at http://${HOST}:${PORT}, pId: ${process.pid}`)
})
