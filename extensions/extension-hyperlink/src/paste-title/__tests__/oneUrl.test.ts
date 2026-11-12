import { describe, expect, it } from 'bun:test'
import { find } from 'linkifyjs'

import { oneUrl } from '../pasteTitle'

// The rule without the whitespace guard. The guard only skips work, so both must always agree.
const unguarded = (text: string) => {
  const links = find(text)
  return links.length === 1 && links[0].type === 'url' && links[0].value === text ? links[0] : null
}

const INPUTS = [
  'https://example.com',
  'example.com',
  'https://example.com/a?b=c#d',
  'https://example.com/a%20b',
  'https://example.com\n',
  '\nhttps://example.com',
  'https://example.com https://foo.org',
  'see https://example.com',
  'https://example.com ',
  'https://exa\tmple.com',
  'me@example.com',
  'mailto:me@example.com',
  'two words',
  'word '.repeat(200),
  ''
]

describe('oneUrl', () => {
  for (const text of INPUTS) {
    it(`agrees with the unguarded rule for ${JSON.stringify(text.slice(0, 40))}`, () => {
      expect(oneUrl(text)).toEqual(unguarded(text))
    })
  }

  it('still finds one bare URL', () => {
    expect(oneUrl('https://example.com')?.href).toBe('https://example.com')
  })
})
