import './setupDom'

import { describe, expect, it } from 'bun:test'

import { linkIconFetcher } from '../linkIconFetcher'

describe('linkIconFetcher', () => {
  it('passes only the origin of the href to src', () => {
    const icons = linkIconFetcher({ src: (o) => '/i?o=' + encodeURIComponent(o) })
    const img = icons({ href: 'https://a.example/path?q=1#x' })!
    expect(img.getAttribute('src')).toBe('/i?o=https%3A%2F%2Fa.example')
  })

  it('returns null for non-http hrefs and never calls src for them', () => {
    const icons = linkIconFetcher({
      src: () => {
        throw new Error('src called')
      }
    })
    expect(icons({ href: 'mailto:a@b.example' })).toBeNull()
    expect(icons({ href: 'tel:+1555' })).toBeNull()
  })

  it('adds the hyperlink-icon-tile class only when tile is true', () => {
    const src = (o: string) => `/i/${new URL(o).hostname}.png`
    const tiled = linkIconFetcher({ src, tile: true })({ href: 'https://a.example/' })!
    const plain = linkIconFetcher({ src })({ href: 'https://a.example/' })!
    expect(tiled.classList.contains('hyperlink-icon-tile')).toBe(true)
    expect(plain.classList.contains('hyperlink-icon-tile')).toBe(false)
  })

  it('makes one request per URL; later imgs get src after the first loads', () => {
    const icons = linkIconFetcher({ src: (o) => `/i/${new URL(o).hostname}.png` })
    const first = icons({ href: 'https://a.example/1' })!
    const second = icons({ href: 'https://a.example/2' })!
    expect(first.getAttribute('src')).toBe('/i/a.example.png')
    expect(second.hasAttribute('src')).toBe(false)
    first.dispatchEvent(new Event('load'))
    expect(second.getAttribute('src')).toBe('/i/a.example.png')
    expect(icons({ href: 'https://a.example/3' })!.getAttribute('src')).toBe('/i/a.example.png')
  })

  it('does not request a URL again after it failed once', () => {
    const icons = linkIconFetcher({ src: (o) => `/i/${new URL(o).hostname}.png` })
    const first = icons({ href: 'https://miss.example/1' })!
    first.dispatchEvent(new Event('error'))
    expect(icons({ href: 'https://miss.example/2' })!.hasAttribute('src')).toBe(false)
    expect(icons({ href: 'https://ok.example/' })!.getAttribute('src')).toBe('/i/ok.example.png')
  })
})
