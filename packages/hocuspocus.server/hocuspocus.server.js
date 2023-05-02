import * as dotenvFlow from 'dotenv-flow'
process.env.NODE_ENV = process.env.NODE_ENV || 'development'

import { Hocuspocus } from '@hocuspocus/server'
import HocuspocusConfig from './hocuspocus.config.mjs'

const Serverconfigure = HocuspocusConfig()

// Configure the server …
const server = new Hocuspocus(Serverconfigure);

// … and run it!
server.listen();
