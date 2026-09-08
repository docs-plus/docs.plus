import type { OwnedDocument } from '../types'
import { buildDocumentsListItems } from './documentsListItems'

const DAY_MS = 86_400_000
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS).toISOString()

const doc = (id: string, updatedAt: string, isFavorite = false): OwnedDocument => ({
  documentId: id,
  slug: id.toLowerCase(),
  title: id,
  readOnly: false,
  isPrivate: false,
  isFavorite,
  updatedAt,
  createdAt: updatedAt
})

const shape = (items: ReturnType<typeof buildDocumentsListItems>) =>
  items.map((item) => {
    if (item.kind === 'doc') return `doc:${item.doc.documentId}:${item.index}`
    if (item.kind === 'bucket') return `bucket:${item.label}`
    return 'hairline'
  })

describe('buildDocumentsListItems', () => {
  it('closes the Favorite block with one hairline', () => {
    const docs = [
      doc('f1', daysAgo(0), true),
      doc('f2', daysAgo(0), true),
      doc('a', daysAgo(0)),
      doc('b', daysAgo(0))
    ]
    expect(shape(buildDocumentsListItems(docs, 'title_asc'))).toEqual([
      'doc:f1:0',
      'doc:f2:1',
      'hairline',
      'doc:a:2',
      'doc:b:3'
    ])
  })

  it('leaves Favorites unbucketed and starts the buckets after the hairline', () => {
    const docs = [doc('f1', daysAgo(40), true), doc('a', daysAgo(0)), doc('b', daysAgo(1))]
    expect(shape(buildDocumentsListItems(docs, 'updatedAt_desc'))).toEqual([
      'doc:f1:0',
      'hairline',
      'bucket:Today',
      'doc:a:1',
      'bucket:Yesterday',
      'doc:b:2'
    ])
  })

  it('opens one bucket header per run of rows', () => {
    const docs = [doc('a', daysAgo(0)), doc('b', daysAgo(0)), doc('c', daysAgo(40))]
    expect(shape(buildDocumentsListItems(docs, 'updatedAt_desc'))).toEqual([
      'bucket:Today',
      'doc:a:0',
      'doc:b:1',
      'bucket:Earlier',
      'doc:c:2'
    ])
  })

  it('adds no bucket header on a name sort', () => {
    const docs = [doc('a', daysAgo(0)), doc('b', daysAgo(40))]
    expect(shape(buildDocumentsListItems(docs, 'title_desc'))).toEqual(['doc:a:0', 'doc:b:1'])
  })

  it('buckets a missing Last opened as Never opened', () => {
    const docs = [{ ...doc('a', daysAgo(0)), lastOpenedAt: null }]
    expect(shape(buildDocumentsListItems(docs, 'lastOpenedAt_desc'))).toEqual([
      'bucket:Never opened',
      'doc:a:0'
    ])
  })

  it('returns nothing for an empty list', () => {
    expect(buildDocumentsListItems([], 'updatedAt_desc')).toEqual([])
  })
})
