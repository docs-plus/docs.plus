import './setupDom'

import { describe, expect, it } from 'bun:test'

import { linkIconMap } from '../linkIconMap'

const srcOf = (el: HTMLElement | null): string | null => el?.getAttribute('src') ?? null

describe('linkIconMap', () => {
  it('throws a TypeError for a key that is not a bare hostname', () => {
    for (const key of ['a/b', 'a:1', 'a?b', 'a#b', 'u@a', 'a b', '*.example', '%2A.example'])
      expect(() => linkIconMap({ [key]: '/i/x.png' }), key).toThrow(TypeError)
  })

  it('matches an IDN key against its punycode href', () => {
    const icons = linkIconMap({ 'bücher.example': '/i/idn.png' })
    expect(srcOf(icons({ href: 'https://xn--bcher-kva.example/' }))).toBe('/i/idn.png')
  })

  it('ignores www. on the key or the href, and a trailing dot on the href host', () => {
    const icons = linkIconMap({ 'www.w.example': '/i/w.png', 'w2.example': '/i/w2.png' })
    expect(srcOf(icons({ href: 'https://w.example/' }))).toBe('/i/w.png')
    expect(srcOf(icons({ href: 'https://www.w2.example/' }))).toBe('/i/w2.png')
    // a fresh map: a second img for a URL waits for the first request
    const fresh = linkIconMap({ 'w2.example': '/i/w2.png' })
    expect(srcOf(fresh({ href: 'https://w2.example./' }))).toBe('/i/w2.png')
  })

  it('matches subdomains, and the longest entry wins', () => {
    expect(
      srcOf(linkIconMap({ 'docs.example': '/i/docs.png' })({ href: 'https://a.b.docs.example/' }))
    ).toBe('/i/docs.png')
    const icons = linkIconMap({ example: '/i/short.png', 'docs.example': '/i/long.png' })
    expect(srcOf(icons({ href: 'https://a.b.docs.example/' }))).toBe('/i/long.png')
  })

  it('returns null for an unlisted host and for lookalikes of a listed one', () => {
    const icons = linkIconMap({ 'docs.plus': '/i/logo.svg' })
    for (const href of [
      'https://evil.example/',
      'https://docs.plus.evil.example/',
      'https://evildocs.plus/'
    ])
      expect(icons({ href }), href).toBeNull()
  })

  it('matches http(s) hrefs only', () => {
    const icons = linkIconMap({ 'map.example': '/i/map.png' })
    expect(srcOf(icons({ href: 'https://map.example/' }))).toBe('/i/map.png')
    expect(icons({ href: 'ftp://map.example/' })).toBeNull()
    expect(icons({ href: 'ws://map.example/' })).toBeNull()
  })

  it('gives a hidden <img> for a string entry and a new element per call for a factory', () => {
    const icons = linkIconMap({
      'map.example': '/i/map.png',
      'factory.example': () => document.createElement('span')
    })
    const img = icons({ href: 'https://map.example/' }) as HTMLImageElement
    expect(img.tagName).toBe('IMG')
    expect(img.hidden).toBe(true)
    expect(img.getAttribute('src')).toBe('/i/map.png')
    const a = icons({ href: 'https://factory.example/' })
    const b = icons({ href: 'https://factory.example/' })
    expect(a).toBeInstanceOf(HTMLElement)
    expect(a).not.toBe(b)
  })

  it('gives an empty <span> whose first background image is the light URL for a pair', () => {
    const icons = linkIconMap({ 'pair.example': { light: '/i/light.png', dark: '/i/dark.png' } })
    const el = icons({ href: 'https://pair.example/' })!
    expect(el.tagName).toBe('SPAN')
    expect(el.textContent).toBe('')
    // The first url(), not "contains": a later jsdom may parse light-dark().
    const first = /url\(\s*["']?([^"')]+)/.exec(el.style.backgroundImage)?.[1]
    expect(first).toBe('/i/light.png')
  })
})
