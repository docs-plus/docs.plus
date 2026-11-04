import { linkTextMismatch } from './linkTextMismatch'

describe('linkTextMismatch', () => {
  test.each([
    [
      'github.com',
      'https://github-login.example.net/session',
      'github.com',
      'github-login.example.net'
    ],
    ['www.x.org', 'https://y.org/', 'www.x.org', 'y.org'],
    [
      'https://paypal.com/login',
      'https://paypal.com.evil.net/',
      'paypal.com',
      'paypal.com.evil.net'
    ],
    ['github.com', 'https://evil-github.com/', 'github.com', 'evil-github.com'],
    ['a.example.com', 'https://b.example.com/', 'a.example.com', 'b.example.com'],
    ['GitHub.com/docs', 'https://gitlab.com/', 'GitHub.com', 'gitlab.com'],
    ['www.example.nl', 'https://other.nl/', 'www.example.nl', 'other.nl'],
    ['  github.com  ', 'https://evil.net', 'github.com', 'evil.net'],
    ['github.com.', 'https://evil.net/', 'github.com', 'evil.net']
  ])('%s opening %s warns', (text, href, says, opens) => {
    expect(linkTextMismatch(text, href)).toEqual({ says, opens })
  })

  test.each([
    ['ordinary words', 'Reuters on the chip market', 'https://www.reuters.com/x'],
    ['same host', 'github.com', 'https://github.com/o/r'],
    ['www on one side', 'www.github.com', 'https://github.com/'],
    ['a subdomain of the text', 'github.com', 'https://gist.github.com/x'],
    ['the text is the subdomain', 'docs.github.com', 'https://github.com/'],
    ['scheme and port differ', 'http://github.com:8080/a', 'https://github.com/'],
    ['punycode href for the same name', 'bücher.de', 'https://xn--bcher-kva.de/'],
    ['a code name', 'Node.js', 'https://nodejs.org/'],
    ['a file name', 'README.md', 'https://github.com/o/r'],
    ['a config file', 'config.yaml', 'https://example.com/'],
    ['a version number', 'v2.3.0', 'https://example.com/'],
    ['an abbreviation', 'e.g.', 'https://example.com/'],
    ['an uncommon ending without www', 'shop.lv', 'https://other.com/'],
    ['a sentence that names a site', 'Visit github.com', 'https://evil.net/'],
    ['an empty text', '', 'https://evil.net/'],
    ['a link host with a trailing dot', 'github.com', 'https://github.com./x']
  ])('%s gives no warning', (_case, text, href) => {
    expect(linkTextMismatch(text, href)).toBeNull()
  })
})
