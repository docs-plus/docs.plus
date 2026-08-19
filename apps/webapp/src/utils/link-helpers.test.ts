/**
 * @jest-environment jsdom
 * @jest-environment-options { "url": "https://app.test/doc/abc" }
 */

import { TIPTAP_NODES } from '@types'

import { buildHeadingHref } from './link-helpers'

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

describe('buildHeadingHref', () => {
  beforeEach(() => {
    // Reset URL between tests via same-origin history API (JSDom-safe).
    window.history.replaceState({}, '', '/doc/abc')
  })

  it('nests a child under its parent heading', () => {
    const editor = makeEditor([
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'Methods', tocId: 'h-methods', level: 1 },
      { type: TIPTAP_NODES.PARAGRAPH_TYPE, text: 'intro' },
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'Setup', tocId: 'h-setup', level: 2 },
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'Run tests', tocId: 'h-run', level: 2 }
    ])
    expect(buildHeadingHref(editor, 'h-setup')).toBe(
      'https://app.test/doc/abc?h=methods%3Esetup&id=h-setup'
    )
  })

  it('keeps Title as root when a later H1 is the target', () => {
    const editor = makeEditor([
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'Intro', tocId: 'h1', level: 1 },
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'Sub Topic', tocId: 'h2', level: 1 }
    ])
    const url = new URL(buildHeadingHref(editor, 'h2'))
    expect(url.searchParams.get('h')).toBe('intro>sub-topic')
    expect(url.searchParams.get('id')).toBe('h2')
  })

  it('walks Title then parents to the target, and drops sibling H1s', () => {
    const editor = makeEditor([
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'docs.plus demo', tocId: 'h-title', level: 1 },
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'Start here', tocId: 'h-start', level: 1 },
      {
        type: TIPTAP_NODES.HEADING_TYPE,
        text: 'A chatroom on every heading',
        tocId: 'h-chat',
        level: 1
      },
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'The table of contents', tocId: 'h-toc', level: 1 },
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'What lands in a row', tocId: 'h-row', level: 2 },
      { type: TIPTAP_NODES.HEADING_TYPE, text: "The row's menu", tocId: 'h-menu', level: 2 }
    ])
    const url = new URL(buildHeadingHref(editor, 'h-menu'))
    expect(url.searchParams.get('h')).toBe("docs.plus-demo>the-table-of-contents>the-row's-menu")
    expect(url.searchParams.get('id')).toBe('h-menu')
  })

  it('sets h from a skip-level nest and a later rise, not document order', () => {
    const editor = makeEditor([
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'Handbook', tocId: 'title', level: 1 },
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'Appendix', tocId: 'appendix', level: 1 },
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'Notes', tocId: 'notes', level: 3 },
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'Extra', tocId: 'extra', level: 4 },
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'Figures', tocId: 'figures', level: 2 }
    ])
    const extra = new URL(buildHeadingHref(editor, 'extra'))
    expect(extra.searchParams.get('h')).toBe('handbook>appendix>notes>extra')
    const figures = new URL(buildHeadingHref(editor, 'figures'))
    expect(figures.searchParams.get('h')).toBe('handbook>appendix>figures')
    expect(figures.searchParams.get('id')).toBe('figures')
  })

  it('handles empty heading text by emitting an empty slug segment', () => {
    const editor = makeEditor([{ type: TIPTAP_NODES.HEADING_TYPE, text: '', tocId: 'h-empty' }])
    const url = new URL(buildHeadingHref(editor, 'h-empty'))
    expect(url.searchParams.get('h')).toBe('')
    expect(url.searchParams.get('id')).toBe('h-empty')
  })
})
