import { describe, expect, it } from 'bun:test'

import { type CardRow, drawnTitle } from '../domain/eligibility'

const row = (patch: Partial<CardRow> = {}): CardRow => ({
  documentId: 'doc1',
  title: 'Field notes',
  isPrivate: false,
  ownerId: 'owner-1',
  deletedAt: null,
  ...patch
})
const drawable = () => true

describe('drawnTitle', () => {
  it('draws the title of a live, public, owned pad', () => {
    expect(drawnTitle(row(), drawable)).toBe('Field notes')
  })

  it('refuses every ineligible row, so the route answers one 404', () => {
    expect(drawnTitle(null, drawable)).toBeNull()
    expect(drawnTitle(row({ deletedAt: new Date(0) }), drawable)).toBeNull()
    expect(drawnTitle(row({ isPrivate: true }), drawable)).toBeNull()
    expect(drawnTitle(row({ ownerId: null }), drawable)).toBeNull()
    expect(drawnTitle(row({ title: null }), drawable)).toBeNull()
    expect(drawnTitle(row({ title: '   ' }), drawable)).toBeNull()
  })

  it('never draws a URL, and refuses a title that is only links', () => {
    expect(drawnTitle(row({ title: 'Notes  https://evil.example/login now' }), drawable)).toBe(
      'Notes [link] now'
    )
    expect(drawnTitle(row({ title: 'https://evil.example/login' }), drawable)).toBeNull()
    expect(drawnTitle(row({ title: 'docs.plus' }), drawable)).toBe('docs.plus')
  })

  it('refuses a title the card font cannot draw', () => {
    expect(drawnTitle(row({ title: 'سلام' }), (line) => /^[\x20-\x7e]*$/.test(line))).toBeNull()
  })
})
