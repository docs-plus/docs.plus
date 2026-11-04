import './setupDom'

import { afterEach, describe, expect, it, spyOn } from 'bun:test'

import { linkIconFor } from '../linkIconFor'
import type { LinkIconResolver } from '../types'

// A host calls this from a chat row's layout effect, where a throw would break the row.
describe('linkIconFor', () => {
  const error = spyOn(console, 'error').mockImplementation(() => {})
  afterEach(() => error.mockClear())

  it('returns null and logs once when the resolver throws', () => {
    const throwing: LinkIconResolver = () => {
      throw new Error('boom')
    }
    expect(linkIconFor(throwing, 'https://a.example')).toBeNull()
    expect(linkIconFor(throwing, 'https://b.example')).toBeNull()
    expect(error).toHaveBeenCalledTimes(1)
  })

  it('refuses an element that is attached or has text', () => {
    const attached = document.createElement('span')
    document.body.append(attached)
    expect(linkIconFor(() => attached, 'https://a.example')).toBeNull()
    const texted = Object.assign(document.createElement('span'), { textContent: 'x' })
    expect(linkIconFor(() => texted, 'https://a.example')).toBeNull()
  })

  it('never calls the resolver for an unsafe href', () => {
    let called = false
    const resolver: LinkIconResolver = () => ((called = true), document.createElement('img'))
    expect(linkIconFor(resolver, 'javascript:alert(1)')).toBeNull()
    expect(called).toBe(false)
  })

  it('marks a fresh icon as decoration, or as an image when it names itself', () => {
    const img = linkIconFor(() => document.createElement('img'), 'https://a.example')
    expect(img?.className).toBe('hyperlink-icon')
    expect(img?.getAttribute('aria-hidden')).toBe('true')
    expect((img as HTMLImageElement).draggable).toBe(false)

    const named = document.createElement('span')
    named.setAttribute('aria-label', 'Heading')
    expect(linkIconFor(() => named, 'https://a.example')?.getAttribute('role')).toBe('img')
  })
})
