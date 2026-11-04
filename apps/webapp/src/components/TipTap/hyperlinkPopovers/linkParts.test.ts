import { linkParts } from './linkParts'

// `URL.host` is always ASCII, so an IDN host reads as punycode and a look-alike never reads as the real site.
describe('linkParts host', () => {
  test.each([
    ['Cyrillic look-alikes', 'https://раураl.com/login', 'xn--l-7sba6dbr.com'],
    ['a marked i', 'https://wìnscp.net/', 'xn--wnscp-tsa.net'],
    ['a normal IDN host too', 'https://bücher.de/a', 'xn--bcher-kva.de'],
    ['a port after the host', 'http://example.com:8080/', 'example.com:8080'],
    ['an ASCII host', 'https://github.com/o/r', 'github.com']
  ])('%s', (_case, href, host) => {
    expect(linkParts(href).host).toBe(host)
  })
})
