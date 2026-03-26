// Library package config - uses shared library config
// Note: ESM syntax required since package.json has "type": "module"
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

export default require('../eslint-config/library.js')
