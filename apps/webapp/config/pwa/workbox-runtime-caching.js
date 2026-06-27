const defaultCache = require('next-pwa/cache')

// next-pwa serializes each route's urlPattern via Function.toString() into sw.js.
// A matcher must therefore be self-contained: any module-scope reference (helper,
// array) becomes a dangling free variable in the worker and throws ReferenceError
// on every intercepted request. If host-bypass is ever needed, put it in the custom
// SW (public/service-worker.js, wired via importScripts) where it is real code.
module.exports = defaultCache
