import { describe, expect, it } from 'bun:test'

import { cardName, type CardRow } from '../domain/eligibility'

const row = (patch: Partial<CardRow> = {}): CardRow => ({
  documentId: 'doc1',
  title: 'Field notes',
  isPrivate: false,
  ownerId: 'owner-1',
  deletedAt: null,
  slug: 'field-notes',
  ...patch
})
const drawable = () => true
const asciiOnly = (line: string) => /^[\x20-\x7e]*$/.test(line)
const nameOf = (...args: Parameters<typeof cardName>) => cardName(...args)?.name ?? null

describe('cardName', () => {
  it('draws the title of a live, public, owned pad', () => {
    expect(nameOf(row(), null, drawable)).toBe('Field notes')
    expect(nameOf(row({ title: 'Ration Club' }), 'House London', drawable)).toBe('Ration Club')
  })

  it('refuses every ineligible row, so the route answers one 404', () => {
    expect(nameOf(null, 'House London', drawable)).toBeNull()
    expect(nameOf(row({ deletedAt: new Date(0) }), 'House London', drawable)).toBeNull()
    expect(nameOf(row({ isPrivate: true }), 'House London', drawable)).toBeNull()
    expect(nameOf(row({ ownerId: null }), 'House London', drawable)).toBeNull()
    expect(nameOf(row({ title: null }), null, drawable)).toBeNull()
    expect(nameOf(row({ title: '   ' }), null, drawable)).toBeNull()
  })

  it('refuses an ownerless row whatever its title', () => {
    const ownerless = { ownerId: null }
    expect(nameOf(row({ ...ownerless, title: 'Ration Club' }), null, drawable)).toBeNull()
    expect(
      nameOf(row({ ...ownerless, title: 'docs.plus/house-london' }), 'House London', drawable)
    ).toBeNull()
  })

  it('never draws a URL, and refuses a title that is only links with no Title', () => {
    expect(nameOf(row({ title: 'Notes  https://evil.example/login now' }), null, drawable)).toBe(
      'Notes [link] now'
    )
    expect(nameOf(row({ title: 'https://evil.example/login' }), null, drawable)).toBeNull()
    expect(nameOf(row({ title: 'docs.plus' }), null, drawable)).toBe('docs.plus')
  })

  it('draws the Title heading when the Pad title is only a link', () => {
    const linkOnly = row({ title: 'docs.plus/house-london' })
    expect(nameOf(linkOnly, 'House London', drawable)).toBe('House London')
    expect(nameOf(linkOnly, '🏠🎉', drawable)).toBeNull()
    expect(nameOf(linkOnly, null, drawable)).toBeNull()
    expect(nameOf(linkOnly, 'https://evil.example/x 🎉', drawable)).toBeNull()
  })

  it('never falls back to the Title for a blank title that holds no link', () => {
    expect(nameOf(row({ title: '   ' }), 'House London', drawable)).toBeNull()
    expect(nameOf(row({ title: '!!!' }), 'House London', drawable)).toBeNull()
  })

  it('keeps a title the card font cannot draw refused, even with a Title', () => {
    expect(nameOf(row({ title: 'سلام' }), null, asciiOnly)).toBeNull()
    expect(nameOf(row({ title: 'سلام' }), 'House London', asciiOnly)).toBeNull()
  })
})
