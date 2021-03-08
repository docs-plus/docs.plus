const path = require('path')
const dotEnvPath = path.resolve(__dirname, '../')
require('dotenv-flow').config({
  silent: true,
  path: dotEnvPath
})
const cluster = require('cluster')
const http = require('http')
const { Server } = require('socket.io')
const redisAdapter = require('socket.io-redis')
const { setupMaster, setupWorker } = require('@socket.io/sticky')
const Settings = require('../settings.json')
const { validateSettings, healthCheckRouter, forkComponents, redisCheckConnection } = require('./common')
const {
  PORT,
  HOST,
  REDIS_URL,
  REDIS_PORT,
  LOADBALANCING_METHOD,
  CLUSTER: clustring,
  INSTANCES: numInstances
} = process.env

redisCheckConnection()

// cluster mode
const CLUSTER = clustring === 'true'
let numCPUs = require('os').cpus().length
const INSTANCES = numInstances.toLocaleLowerCase() === 'max' ? numCPUs : +numInstances
if (CLUSTER && INSTANCES) numCPUs = INSTANCES

validateSettings(Settings)

const initHttpService = () => {
  return new Promise(resolve => {
    const httpServer = http.createServer()
    httpServer.listen(PORT, () => {
      console.info(`Websocket gateway running at http://${HOST}:${PORT}`)
      resolve(httpServer)
    })
  })
}

const runSocketWorker = (httpServer) => {
  console.info(`Socket ${process.pid} started`)
  httpServer = httpServer || http.createServer(healthCheckRouter)
  const io = new Server(httpServer)

  io.adapter(redisAdapter({
    host: REDIS_URL,
    port: REDIS_PORT
  }))

  if (CLUSTER) {
    setupWorker(io)
  }

  forkComponents(Settings, io)
}

;(async () => {
  if (!CLUSTER) {
    const httpServer = await initHttpService()
    runSocketWorker(httpServer)
    return
  }

  if (cluster.isMaster) {
    console.info(`Master ${process.pid} is running`)

    const httpServer = await initHttpService()

    setupMaster(httpServer, {
      loadBalancingMethod: LOADBALANCING_METHOD
    })

    for (let i = 0; i < numCPUs; i++) {
      cluster.fork()
    }

    cluster.on('exit', (worker) => {
      console.error(`Worker ${worker.process.pid} died`)
      cluster.fork()
    })
  } else {
    runSocketWorker()
  }
})()
