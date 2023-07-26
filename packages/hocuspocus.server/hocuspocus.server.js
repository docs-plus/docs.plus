import * as dotenvFlow from 'dotenv-flow'
import { Hocuspocus } from '@hocuspocus/server'
import HocuspocusConfig from './hocuspocus.config.mjs'

dotenvFlow.config()
process.env.NODE_ENV = process.env.NODE_ENV || 'development'

const Serverconfigure = HocuspocusConfig()

// Configure the server …
const server = new Hocuspocus(Serverconfigure)

// … and run it!
server.listen()
