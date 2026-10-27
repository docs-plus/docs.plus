import { describe, expect, test } from 'bun:test'

import { pickIconHref } from '../../domain/iconLinks'

const BASE = 'https://example.com/'

describe('pickIconHref', () => {
  test.each([
    [
      'a relative href, resolved against the page',
      '<link rel="icon" href="/i.png">',
      'https://example.com/i.png'
    ],
    [
      'rel="shortcut icon", unquoted',
      '<LINK REL="shortcut icon" HREF=/f.ico>',
      'https://example.com/f.ico'
    ],
    [
      'an entity in the query',
      "<link rel='icon' href='/i.png?a=1&amp;b=2'>",
      'https://example.com/i.png?a=1&b=2'
    ],
    [
      'a cross-origin CDN href',
      '<link rel="icon" href="//cdn.example.net/i.png">',
      'https://cdn.example.net/i.png'
    ],
    [
      'apple-touch-icon when nothing else is there',
      '<link rel="apple-touch-icon" href="/t.png">',
      'https://example.com/t.png'
    ]
  ])('%s', (_name, head, expected) => {
    expect(pickIconHref(head, BASE)).toBe(expected)
  })

  test('prefers a rel=icon PNG nearest 32 px over larger sizes, other types and apple-touch', () => {
    const head = [
      '<link rel="apple-touch-icon" sizes="32x32" href="/touch.png">',
      '<link rel="icon" sizes="32x32" href="/i32.gif">',
      '<link rel="icon" sizes="192x192" href="/i192.png">',
      '<link rel="icon" sizes="16x16 32x32" href="/i32.png">'
    ].join('')
    expect(pickIconHref(head, BASE)).toBe('https://example.com/i32.png')
  })

  test('ignores an icon link after </head>', () => {
    const html =
      '<link rel="apple-touch-icon" href="/touch.png"></HEAD><body><link rel="icon" href="/b.png">'
    expect(pickIconHref(html, BASE)).toBe('https://example.com/touch.png')
  })

  test.each([
    ['an SVG by type', '<link rel="icon" type="image/svg+xml" href="/a">'],
    ['an SVG by path', '<link rel="icon" href="/a.SVG?v=2">'],
    ['a data: URL', '<link rel="icon" href="data:image/png;base64,iVBORw0KGgo=">'],
    ['a javascript: URL', '<link rel="icon" href="javascript:alert(1)">'],
    ['mask-icon, which is SVG', '<link rel="mask-icon" href="/m.png">'],
    ['an empty href', '<link rel="icon" href="">'],
    ['no link at all', '<meta name="x" content="icon"><title>icon</title>']
  ])('skips %s', (_name, head) => {
    expect(pickIconHref(head, BASE)).toBeNull()
  })
})
