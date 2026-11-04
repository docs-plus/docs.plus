import { describe, expect, test } from 'bun:test'

import { iconSiteOrigin } from '../../domain/icon'

describe('iconSiteOrigin', () => {
  test.each([
    ['a data label', 'https://c2VjcmV0.attacker.example', 'https://attacker.example'],
    ['deep labels', 'https://a.b.c.attacker.example', 'https://attacker.example'],
    ['www', 'https://www.example.com', 'https://example.com'],
    ['a two-part suffix', 'https://data.example.co.uk', 'https://example.co.uk'],
    ['a private suffix, read as ICANN only', 'https://data.user.github.io', 'https://github.io'],
    ['plain http', 'http://data.example.org', 'http://example.org'],
    ['a site already at its domain', 'https://example.com', 'https://example.com']
  ])('keeps only the registrable domain: %s', (_case, origin, site) => {
    expect(iconSiteOrigin(origin)).toBe(site)
  })

  test('passes an IP as is', () => {
    expect(iconSiteOrigin('http://93.184.216.34')).toBe('http://93.184.216.34')
  })

  test.each(['https://co.uk', 'https://com', 'https://intranet'])(
    'answers null for a host with no registrable domain: %s',
    (origin) => {
      expect(iconSiteOrigin(origin)).toBeNull()
    }
  )
})
