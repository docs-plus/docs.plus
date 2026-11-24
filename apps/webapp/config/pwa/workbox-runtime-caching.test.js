/** @jest-environment node */

const vm = require('vm')
const path = require('path')

const rules = require(path.resolve(__dirname, './workbox-runtime-caching.js'))

const matchFirst = (urlStr, accept, destination = 'document') => {
  const url = new URL(urlStr)
  const request = {
    headers: new Headers(accept ? { accept } : {}),
    destination
  }

  for (const rule of rules) {
    const pattern = rule.urlPattern
    let hit = false
    if (pattern instanceof RegExp) {
      hit = pattern.test(url.href)
    } else if (typeof pattern === 'function') {
      // Simulate next-pwa Function.toString() serialization into sw.js.
      const compiled = vm.runInNewContext(`(${pattern.toString()})`, {
        self: { origin: 'https://docs.plus' }
      })
      hit = Boolean(compiled({ url, request }))
    }
    if (hit) {
      return { handler: rule.handler, cacheName: rule.options?.cacheName ?? null }
    }
  }

  return null
}

describe('workbox-runtime-caching markdown negotiation isolation', () => {
  it('routes Accept: text/markdown requests to NetworkOnly before others/apis caches', () => {
    expect(matchFirst('https://docs.plus/my-pad', 'text/markdown')).toEqual({
      handler: 'NetworkOnly',
      cacheName: null
    })
    expect(matchFirst('https://docs.plus/my-pad', 'text/markdown, text/html;q=0.8')).toEqual({
      handler: 'NetworkOnly',
      cacheName: null
    })
    expect(matchFirst('https://docs.plus/notes.json', 'text/markdown')).toEqual({
      handler: 'NetworkOnly',
      cacheName: null
    })
    expect(
      matchFirst('https://api.docs.plus/api/documents/my-pad/markdown', 'text/markdown')
    ).toEqual({
      handler: 'NetworkOnly',
      cacheName: null
    })
  })

  it('keeps standard HTML requests on the NetworkFirst others cache', () => {
    expect(
      matchFirst('https://docs.plus/my-pad', 'text/html,application/xhtml+xml,*/*;q=0.8')
    ).toEqual({
      handler: 'NetworkFirst',
      cacheName: 'others'
    })
    expect(matchFirst('https://docs.plus/my-pad', '*/*')).toEqual({
      handler: 'NetworkFirst',
      cacheName: 'others'
    })
  })
})
