// Backend service config - uses base shared config
// Note: ESM syntax required since package.json has "type": "module"
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

// Use relative path for workspace package in ESM context
export default require('../eslint-config/index.js')
