import dotenvFlow from 'dotenv-flow'
import { Hocuspocus } from '@hocuspocus/server'
import HocuspocusConfig from './hocuspocus.config.mjs'

process.env.NODE_ENV = process.env.NODE_ENV || 'development'

dotenvFlow.config({
  purge_dotenv: true,
  node_env: process.env.NODE_ENV,
  silent: true
})
const Serverconfigure = HocuspocusConfig()

// Configure the server …
const server = new Hocuspocus(Serverconfigure)

// … and run it!
server.listen()
