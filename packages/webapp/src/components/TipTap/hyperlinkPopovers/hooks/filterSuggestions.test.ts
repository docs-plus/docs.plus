import { filterSuggestions, isUrlShaped } from './filterSuggestions'

const headings = [
  {
    kind: 'heading' as const,
    id: 'h1',
    title: 'Setup Guide',
    level: 1 as const,
    breadcrumb: ['setup-guide']
  },
  {
    kind: 'heading' as const,
    id: 'h2',
    title: 'Setup Helpers',
    level: 2 as const,
    breadcrumb: ['setup-guide', 'setup-helpers']
  },
  {
    kind: 'heading' as const,
    id: 'h3',
    title: 'Run tests',
    level: 1 as const,
    breadcrumb: ['run-tests']
  }
]

const bookmarks = [
  {
    kind: 'bookmark' as const,
    id: 'b1',
    title: 'Setup notes',
    messageId: 'm1',
    channelId: 'c1',
    archived: false,
    createdAt: '2026-04-01'
  }
]

describe('isUrlShaped', () => {
  it.each([
    ['https://example.com', true],
    ['http://x.y', true],
    ['mailto:a@b.com', true],
    ['ftp://server', true],
    ['setup', false],
    ['', false],
    ['  ', false]
  ])('returns %p for %p', (input, expected) => {
    expect(isUrlShaped(input)).toBe(expected)
  })
})

describe('filterSuggestions', () => {
  it('returns everything unfiltered when query is empty', () => {
    const out = filterSuggestions({ query: '', headings, bookmarks })
    expect(out.headings).toHaveLength(3)
    expect(out.bookmarks).toHaveLength(1)
  })

  it('returns everything unfiltered when query is URL-shaped', () => {
    const out = filterSuggestions({ query: 'https://example.com', headings, bookmarks })
    expect(out.headings).toHaveLength(3)
    expect(out.bookmarks).toHaveLength(1)
  })

  it('filters by case-insensitive substring on title', () => {
    const out = filterSuggestions({ query: 'setup', headings, bookmarks })
    expect(out.headings.map((h) => h.id)).toEqual(['h1', 'h2'])
    expect(out.bookmarks.map((b) => b.id)).toEqual(['b1'])
  })

  it('ranks starts-with matches above contains matches', () => {
    const out = filterSuggestions({
      query: 'setup',
      headings: [
        { ...headings[1] },
        { ...headings[0] },
        {
          kind: 'heading' as const,
          id: 'h4',
          title: 'New setup notes',
          level: 1 as const,
          breadcrumb: ['x']
        }
      ],
      bookmarks: []
    })
    expect(out.headings.map((h) => h.id)).toEqual(['h2', 'h1', 'h4'])
  })
})
