import type { Editor } from '@tiptap/core'
import { type Node as PMNode, Schema } from '@tiptap/pm/model'

import { editorCardReply } from './editorCard'
import { filterTitle, parseCardReply, toCardView } from './model'

const NOW = new Date('2026-11-03T12:00:00Z')
const view = (data: unknown) => {
  const reply = parseCardReply(data)
  return reply ? toCardView(reply, NOW) : { state: 'empty' }
}
const editorOf = (doc: PMNode) => ({ state: { doc } }) as unknown as Editor
const localView = (...args: Parameters<typeof editorCardReply>) => {
  const reply = editorCardReply(...args)
  return reply && toCardView(reply, NOW)
}

describe('toCardView, route replies', () => {
  test('another pad: title, no breadcrumb, a count and two sections on the rail', () => {
    expect(
      view({ kind: 'pad', title: 'Q3 launch plan', sections: ['Goals', 'Budget'], total: 6 })
    ).toEqual({
      state: 'data',
      title: 'Q3 launch plan',
      crumbs: [],
      facts: [{ icon: 'sections', text: '6 sections' }],
      rail: { items: ['Goals', 'Budget'], more: 4 },
      description: null
    })
    expect(view({ kind: 'pad', title: 'Notes', sections: ['Only'], total: 1 })).toMatchObject({
      facts: [{ icon: 'sections', text: '1 section' }],
      rail: { items: ['Only'], more: 0 }
    })
    expect(view({ kind: 'pad', title: 'Blank', sections: [], total: 0 })).toMatchObject({
      facts: [],
      rail: null
    })
  })

  test('heading: breadcrumb is the pad title then parents; zero counts stay out', () => {
    const reply = {
      kind: 'heading',
      padTitle: 'Q3 launch plan',
      title: 'Marketing spend',
      trail: ['Budget'],
      subsections: 1,
      lines: ['Most of the budget goes to the launch post.', 'The rest is design.'],
      messages: 0
    }
    expect(view(reply)).toEqual({
      state: 'data',
      title: 'Marketing spend',
      crumbs: ['Q3 launch plan', 'Budget'],
      facts: [{ icon: 'sections', text: '1 subsection' }],
      rail: null,
      description: 'Most of the budget goes to the launch post. The rest is design.'
    })
    expect(view({ ...reply, subsections: 0, messages: 1 })).toMatchObject({
      facts: [{ icon: 'messages', text: '1 message' }]
    })
    // A route that could not read the chat omits the count: unknown, so no message fact.
    const { messages: _messages, ...unknownCount } = reply
    expect(view({ ...unknownCount, subsections: 0 })).toMatchObject({ facts: [] })
  })

  test('heading chat and chat message: counts and dates, never text or names', () => {
    const where = { padTitle: 'Q3 launch plan', heading: 'Marketing spend', trail: ['Budget'] }
    expect(
      view({ kind: 'chat', ...where, messages: 12, lastMessageAt: '2026-11-02T09:00:00Z' })
    ).toMatchObject({
      title: 'Marketing spend chat',
      crumbs: ['Q3 launch plan', 'Budget'],
      facts: [
        { icon: 'messages', text: '12 messages' },
        { icon: 'date', text: 'Last message Nov 2' }
      ]
    })
    expect(
      view({ kind: 'message', ...where, sentAt: '2025-11-02T09:00:00Z', replies: 1, reactions: 5 })
    ).toMatchObject({
      title: 'Message in Marketing spend chat',
      facts: [
        { icon: 'date', text: 'Sent Nov 2, 2025' },
        { icon: 'replies', text: '1 reply' },
        { icon: 'reactions', text: '5 reactions' }
      ]
    })
  })

  test('version and version history', () => {
    const version = {
      kind: 'version',
      padTitle: 'Q3 launch plan',
      version: 12,
      savedAt: '2026-11-02T09:00:00Z'
    }
    expect(
      view({
        ...version,
        name: 'Before the budget review',
        sectionsChanged: 3,
        wordsAdded: 1,
        wordsRemoved: 40
      })
    ).toEqual({
      state: 'data',
      title: 'Before the budget review',
      crumbs: ['Q3 launch plan', 'Version history'],
      facts: [
        { icon: 'versions', text: 'Version 12' },
        { icon: 'date', text: 'Saved Nov 2' }
      ],
      rail: null,
      description: '3 sections changed: 1 word added, 40 removed.'
    })
    expect(view(version)).toMatchObject({
      title: 'Version 12',
      facts: [{ icon: 'date', text: 'Saved Nov 2' }],
      description: null
    })
    expect(view({ kind: 'history', padTitle: 'Q3 launch plan', versions: 1 })).toMatchObject({
      title: 'Version history',
      crumbs: ['Q3 launch plan'],
      facts: [{ icon: 'versions', text: '1 version' }]
    })
  })

  test('filter: shown count of all sections, and the first shown titles on the rail', () => {
    const reply = {
      kind: 'filter',
      padTitle: 'Q3 launch plan',
      terms: ['budget', 'launch'],
      mode: 'and',
      shown: ['Budget', 'Marketing spend', 'Launch'],
      shownCount: 3,
      total: 6
    }
    expect(view(reply)).toMatchObject({
      title: 'Filter for “budget” and “launch”',
      crumbs: ['Q3 launch plan'],
      facts: [{ icon: 'sections', text: 'Shows 3 of 6 sections' }],
      rail: { items: ['Budget', 'Marketing spend'], more: 1 }
    })
  })

  test('locked shows only the notice; a missing or broken reply is the no-preview line', () => {
    expect(view({ locked: true, title: 'leak' })).toEqual({ state: 'locked' })
    expect(view({ kind: 'pad', title: 'X', sections: 'Goals', total: 1 })).toEqual({
      state: 'empty'
    })
    expect(view({ kind: 'unknown' })).toEqual({ state: 'empty' })
  })
})

describe('filterTitle', () => {
  test('quotes each term and joins by mode; four or more fold into "N more terms"', () => {
    expect(filterTitle(['a'], 'and')).toBe('Filter for “a”')
    expect(filterTitle(['a', 'b'], 'and')).toBe('Filter for “a” and “b”')
    expect(filterTitle(['a', 'b'], 'or')).toBe('Filter for “a” or “b”')
    expect(filterTitle(['a', 'b', 'c'], 'and')).toBe('Filter for “a”, “b” and “c”')
    expect(filterTitle(['a', 'b', 'c', 'd'], 'and')).toBe('Filter for “a”, “b” and 2 more terms')
  })
})

describe('editorCardReply, this pad', () => {
  const schema = new Schema({
    nodes: {
      doc: { content: 'block+' },
      text: { group: 'inline' },
      paragraph: { group: 'block', content: 'text*' },
      heading: {
        group: 'block',
        content: 'text*',
        attrs: { level: { default: 1 }, 'toc-id': { default: null } }
      }
    }
  })
  const h = (level: number, id: string, text: string) =>
    schema.node('heading', { level, 'toc-id': id }, schema.text(text))
  const p = (text: string) => schema.node('paragraph', null, text ? schema.text(text) : undefined)
  const doc = schema.node('doc', null, [
    h(1, 'title', 'Q3 launch plan'),
    h(2, 'goals', 'Goals'),
    p('Ship it.'),
    h(2, 'budget', 'Budget'),
    p('Money first.'),
    p(''),
    p('Then time.'),
    h(3, 'marketing', 'Marketing spend'),
    h(4, 'video', 'Video'),
    h(3, 'design', 'Design time'),
    h(2, 'launch', 'Launch')
  ])

  test('a heading reads its parents, its deeper headings and its first lines', () => {
    expect(
      localView(editorOf(doc), { kind: 'heading', headingId: 'marketing' }, 'Q3 launch plan')
    ).toMatchObject({ title: 'Marketing spend', crumbs: ['Q3 launch plan', 'Budget'] })
    expect(
      editorCardReply(editorOf(doc), { kind: 'heading', headingId: 'budget' }, 'Q3 launch plan')
    ).toEqual({
      kind: 'heading',
      padTitle: 'Q3 launch plan',
      title: 'Budget',
      trail: [],
      subsections: 3,
      lines: ['Money first.', 'Then time.'],
      messages: null
    })
    expect(
      editorCardReply(editorOf(doc), { kind: 'heading', headingId: 'gone' }, 'Q3 launch plan')
    ).toBeNull()
  })

  test('first lines keep the words of list items apart', () => {
    const listSchema = new Schema({
      nodes: {
        doc: { content: 'block+' },
        text: { group: 'inline' },
        paragraph: { group: 'block', content: 'text*' },
        heading: {
          group: 'block',
          content: 'text*',
          attrs: { level: { default: 1 }, 'toc-id': { default: null } }
        },
        bulletList: { group: 'block', content: 'listItem+' },
        listItem: { content: 'paragraph+' }
      }
    })
    const item = (text: string) =>
      listSchema.node('listItem', null, listSchema.node('paragraph', null, listSchema.text(text)))
    const listDoc = listSchema.node('doc', null, [
      listSchema.node('heading', { level: 1, 'toc-id': 'title' }, listSchema.text('Links')),
      listSchema.node('heading', { level: 2, 'toc-id': 'code' }, listSchema.text('Code')),
      listSchema.node('bulletList', null, [item('oven-sh/bun'), item('docs-plus/docs.plus')])
    ])
    expect(
      editorCardReply(editorOf(listDoc), { kind: 'heading', headingId: 'code' }, 'Links')
    ).toMatchObject({ lines: ['oven-sh/bun', 'docs-plus/docs.plus'] })
  })

  test('a filter shows what the filter engine shows, counted against every section', () => {
    const link = {
      kind: 'filter' as const,
      terms: ['marketing'],
      mode: 'or' as const,
      href: '/pad/marketing'
    }
    expect(localView(editorOf(doc), link, 'Q3 launch plan')).toMatchObject({
      title: 'Filter for “marketing”',
      facts: [{ icon: 'sections', text: 'Shows 3 of 6 sections' }],
      rail: { items: ['Budget', 'Marketing spend'], more: 1 }
    })
  })
})
