import type { InfiniteData } from '@tanstack/react-query'

import type { DocumentsPage, OwnedDocument } from '../types'
import {
  insertDocumentAtSlot,
  nextDocumentsOffset,
  patchDocumentInPages,
  removeDocumentFromPages,
  removeDocumentsFromPages,
  setFavoriteInPages
} from './documentsPageCache'

const doc = (id: string, isFavorite = false): OwnedDocument => ({
  documentId: id,
  slug: id.toLowerCase(),
  title: id,
  readOnly: false,
  isPrivate: false,
  isFavorite,
  updatedAt: '2026-09-01T00:00:00.000Z',
  createdAt: '2026-09-01T00:00:00.000Z'
})

// `pageParams` are row offsets in production. Nothing here reads them, so the placeholder
// indexes below carry no meaning — read `nextDocumentsOffset` for the real contract.
const pages = (total: number, ...sizes: string[][]): InfiniteData<DocumentsPage> => ({
  pages: sizes.map((ids) => ({ total, docs: ids.map((id) => doc(id)) })),
  pageParams: sizes.map((_, i) => i)
})

const ids = (data: InfiniteData<DocumentsPage>) =>
  data.pages.map((page) => page.docs.map((d) => d.documentId))

describe('nextDocumentsOffset', () => {
  it('asks for the row after the ones already held', () => {
    expect(nextDocumentsOffset([{ total: 45, docs: [doc('a'), doc('b')] }], 45)).toBe(2)
  })

  it('stops once the loaded rows reach the total', () => {
    expect(nextDocumentsOffset([{ total: 2, docs: [doc('a'), doc('b')] }], 2)).toBeUndefined()
  })

  it('counts every loaded page, not the last one', () => {
    const data = pages(45, ['a', 'b'], ['c'])
    expect(nextDocumentsOffset(data.pages, 45)).toBe(3)
  })

  it('shifts down after an optimistic remove, so Load more skips no document', () => {
    // 45 owned documents, page one of 20 loaded, then the sixth row is deleted.
    const first = Array.from({ length: 20 }, (_, i) => `d${i}`)
    const loaded = pages(45, first)
    const after = removeDocumentsFromPages(loaded, ['d5'])
    // A page index would ask for offset 20 and the server list has already shifted down.
    expect(nextDocumentsOffset(after.pages, after.pages[0].total)).toBe(19)
  })
})

describe('removeDocumentFromPages', () => {
  it('reports the slot the row sat in', () => {
    const outcome = removeDocumentFromPages(pages(3, ['a', 'b'], ['c']), 'c')
    expect(outcome?.slot).toEqual({ pageIndex: 1, indexInPage: 0 })
    expect(outcome?.removed.documentId).toBe('c')
    expect(ids(outcome!.pages)).toEqual([['a', 'b'], []])
  })

  it('drops the same total from every page, so the pages never disagree', () => {
    const outcome = removeDocumentFromPages(pages(3, ['a', 'b'], ['c']), 'a')
    expect(outcome?.pages.pages.map((page) => page.total)).toEqual([2, 2])
  })

  it('answers null when the list never held the row', () => {
    expect(removeDocumentFromPages(pages(2, ['a', 'b']), 'zzz')).toBeNull()
  })
})

describe('insertDocumentAtSlot', () => {
  it('puts a removed row back in the middle of its page, not at the end', () => {
    const before = pages(4, ['a', 'b', 'c'], ['d'])
    const outcome = removeDocumentFromPages(before, 'b')!
    const after = insertDocumentAtSlot(outcome.pages, outcome.removed, outcome.slot)
    expect(ids(after)).toEqual([['a', 'b', 'c'], ['d']])
    expect(after.pages.map((page) => page.total)).toEqual([4, 4])
  })

  it('leaves the other pages untouched', () => {
    const outcome = removeDocumentFromPages(pages(4, ['a', 'b'], ['c', 'd']), 'c')!
    const after = insertDocumentAtSlot(outcome.pages, outcome.removed, outcome.slot)
    expect(ids(after)).toEqual([
      ['a', 'b'],
      ['c', 'd']
    ])
  })
})

describe('patchDocumentInPages', () => {
  it('changes only the named row and leaves the page shape alone', () => {
    const next = patchDocumentInPages(pages(3, ['a', 'b'], ['c']), 'b', { title: 'Renamed' })
    expect(next.pages[0].docs.map((d) => d.title)).toEqual(['a', 'Renamed'])
    expect(next.pages[1].docs.map((d) => d.title)).toEqual(['c'])
  })
})

describe('setFavoriteInPages', () => {
  // The write-back keeps the loaded page sizes, and a reorder moves no total.
  it('pins the marked row to the top of the loaded list', () => {
    const next = setFavoriteInPages(pages(3, ['a', 'b'], ['c']), 'c', true)
    expect(ids(next)).toEqual([['c', 'a'], ['b']])
    expect(next.pages.map((page) => page.total)).toEqual([3, 3])
  })

  it('drops an unmarked row back below the Favorites', () => {
    const data: InfiniteData<DocumentsPage> = {
      pages: [{ total: 3, docs: [doc('fav', true), doc('a'), doc('b')] }],
      pageParams: [0]
    }
    expect(ids(setFavoriteInPages(data, 'fav', false))).toEqual([['fav', 'a', 'b']])
    expect(ids(setFavoriteInPages(data, 'b', true))).toEqual([['fav', 'b', 'a']])
  })
})
