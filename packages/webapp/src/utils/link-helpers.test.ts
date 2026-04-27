/**
 * @jest-environment jsdom
 * @jest-environment-options { "url": "https://app.test/doc/abc" }
 */

import { TIPTAP_NODES } from '@types'

import { buildHeadingHref } from './link-helpers'

const makeEditor = (children: Array<{ type: string; text: string; tocId?: string }>) => {
  const doc = {
    content: {
      childCount: children.length,
      child: (i: number) => {
        const c = children[i]
        return {
          type: { name: c.type },
          textContent: c.text,
          attrs: { 'toc-id': c.tocId ?? null }
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

  it('builds an h>chain ending at the target heading', () => {
    const editor = makeEditor([
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'Methods', tocId: 'h-methods' },
      { type: TIPTAP_NODES.PARAGRAPH_TYPE, text: 'intro' },
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'Setup', tocId: 'h-setup' },
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'Run tests', tocId: 'h-run' }
    ])
    expect(buildHeadingHref(editor, 'h-setup')).toBe(
      'https://app.test/doc/abc?h=methods%3Esetup&id=h-setup'
    )
  })

  it('returns the same shape useTocActions.copyLink produces today', () => {
    const editor = makeEditor([
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'Intro', tocId: 'h1' },
      { type: TIPTAP_NODES.HEADING_TYPE, text: 'Sub Topic', tocId: 'h2' }
    ])
    const url = new URL(buildHeadingHref(editor, 'h2'))
    expect(url.searchParams.get('h')).toBe('intro>sub-topic')
    expect(url.searchParams.get('id')).toBe('h2')
  })

  it('handles empty heading text by emitting an empty slug segment', () => {
    const editor = makeEditor([{ type: TIPTAP_NODES.HEADING_TYPE, text: '', tocId: 'h-empty' }])
    const url = new URL(buildHeadingHref(editor, 'h-empty'))
    expect(url.searchParams.get('h')).toBe('')
    expect(url.searchParams.get('id')).toBe('h-empty')
  })
})
