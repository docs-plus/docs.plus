import { TIPTAP_NODES } from '@types'

import { headingAncestry, headingSlug, headingSlugTrail } from './headingSlugTrail'

const heading = (text: string, tocId: string, level: number) => ({
  type: TIPTAP_NODES.HEADING_TYPE,
  text,
  tocId,
  level
})

const paragraph = (text: string) => ({
  type: TIPTAP_NODES.PARAGRAPH_TYPE,
  text
})

const makeEditor = (
  children: Array<{ type: string; text: string; tocId?: string; level?: number }>
) => {
  const doc = {
    content: {
      childCount: children.length,
      child: (i: number) => {
        const c = children[i]
        return {
          type: { name: c.type },
          textContent: c.text,
          attrs: { 'toc-id': c.tocId ?? null, level: c.level ?? 1 }
        }
      }
    }
  }
  return { state: { doc } } as any
}

/** Title, H1–H6 nest, siblings, later H1s, skip-level H3, then rise to H2. */
const complexOutline = makeEditor([
  heading('Handbook', 'title', 1),
  paragraph('lead-in'),
  heading('Overview', 'overview', 1),
  heading('Goals', 'goals', 2),
  heading('Metrics', 'metrics', 3),
  heading('North star', 'north', 4),
  heading('Weekly', 'weekly', 5),
  heading('Monday', 'monday', 6),
  paragraph('section body'),
  heading('Risks', 'risks', 3),
  heading('Timeline', 'timeline', 2),
  heading('Q1', 'q1', 3),
  heading('Methods', 'methods', 1),
  heading('Setup', 'setup', 2),
  heading('Install', 'install', 3),
  heading('Run tests', 'run', 2),
  heading('Appendix', 'appendix', 1),
  heading('Notes', 'notes', 3),
  heading('Extra', 'extra', 4),
  heading('Figures', 'figures', 2),
  heading('Closing', 'closing', 1)
])

const ancestryIds = (headingId: string): string[] =>
  headingAncestry(complexOutline, headingId).map((item) => item.id)

describe('headingAncestry', () => {
  it.each([
    ['Title itself', 'title', ['title']],
    ['first H1 under Title', 'overview', ['title', 'overview']],
    [
      'deep H6 nest',
      'monday',
      ['title', 'overview', 'goals', 'metrics', 'north', 'weekly', 'monday']
    ],
    ['H3 sibling drops the previous H3 nest', 'risks', ['title', 'overview', 'goals', 'risks']],
    ['H2 sibling drops the H2/H3 nest', 'timeline', ['title', 'overview', 'timeline']],
    ['child after a rise back to H2', 'q1', ['title', 'overview', 'timeline', 'q1']],
    ['later H1 drops the previous section', 'methods', ['title', 'methods']],
    ['H3 under a later H1', 'install', ['title', 'methods', 'setup', 'install']],
    ['H2 sibling under a later H1', 'run', ['title', 'methods', 'run']],
    ['skip-level H3 under an H1', 'notes', ['title', 'appendix', 'notes']],
    ['H4 under a skip-level H3', 'extra', ['title', 'appendix', 'notes', 'extra']],
    ['H2 after a skip-level nest pops H3 and H4', 'figures', ['title', 'appendix', 'figures']],
    ['last H1 drops every prior section', 'closing', ['title', 'closing']]
  ] as const)('%s', (_name, headingId, expected) => {
    expect(ancestryIds(headingId)).toEqual([...expected])
  })

  it('returns empty when the heading is not in the document', () => {
    expect(headingAncestry(complexOutline, 'missing')).toEqual([])
  })

  it('keeps Title when the first heading is not level 1', () => {
    const editor = makeEditor([
      heading('Deck', 'title', 2),
      heading('Chapter', 'chapter', 1),
      heading('Scene', 'scene', 3)
    ])
    expect(headingAncestry(editor, 'scene').map((item) => item.id)).toEqual([
      'title',
      'chapter',
      'scene'
    ])
  })
})

describe('headingSlugTrail', () => {
  it.each([
    ['title', 'handbook'],
    ['monday', 'handbook>overview>goals>metrics>north-star>weekly>monday'],
    ['risks', 'handbook>overview>goals>risks'],
    ['q1', 'handbook>overview>timeline>q1'],
    ['install', 'handbook>methods>setup>install'],
    ['notes', 'handbook>appendix>notes'],
    ['figures', 'handbook>appendix>figures'],
    ['closing', 'handbook>closing']
  ] as const)('joins outline slugs for %s', (headingId, trail) => {
    expect(headingSlugTrail(complexOutline, headingId)).toBe(trail)
  })

  it('does not join headings that only appear earlier in document order', () => {
    const trail = headingSlugTrail(complexOutline, 'monday')
    expect(trail.includes('methods')).toBe(false)
    expect(trail.includes('appendix')).toBe(false)
    expect(trail.includes('risks')).toBe(false)
    expect(trail.split('>')).toHaveLength(7)
  })

  it('keeps an empty slug segment when a parent heading has no text', () => {
    const editor = makeEditor([
      heading('Handbook', 'title', 1),
      heading('', 'blank', 2),
      heading('Leaf', 'leaf', 3)
    ])
    expect(headingSlugTrail(editor, 'leaf')).toBe('handbook>>leaf')
  })

  it('returns empty when the heading is not in the document', () => {
    expect(headingSlugTrail(complexOutline, 'missing')).toBe('')
  })
})

describe('headingSlug', () => {
  it('keeps an apostrophe in the slug', () => {
    expect(headingSlug("The row's menu")).toBe("the-row's-menu")
  })
})
