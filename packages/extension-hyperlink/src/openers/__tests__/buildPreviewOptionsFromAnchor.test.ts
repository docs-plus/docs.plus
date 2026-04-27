/// <reference types="bun-types" />

import { describe, expect, it } from 'bun:test'
import type { Editor } from '@tiptap/core'

import { buildPreviewOptionsFromAnchor } from '../buildPreviewOptionsFromAnchor'

const anchor = (attrs: { href: string; text: string; isConnected: boolean }): HTMLAnchorElement => {
  const element = {
    isConnected: attrs.isConnected,
    textContent: attrs.text,
    getAttribute: (name: string) => (name === 'href' ? attrs.href : null),
    closest: (selector: string) => (selector === 'a' ? element : null)
  }
  return element as unknown as HTMLAnchorElement
}

describe('buildPreviewOptionsFromAnchor', () => {
  it('uses a live equivalent anchor when the supplied DOM node is detached', () => {
    const detachedLink = anchor({
      href: 'https://example.test',
      text: 'Example',
      isConnected: false
    })
    const liveLink = anchor({ href: 'https://example.test', text: 'Example', isConnected: true })
    const mark = {
      type: { name: 'hyperlink' },
      attrs: {
        href: 'https://example.test',
        target: null,
        rel: null,
        class: null,
        title: null,
        image: null
      }
    }
    const editor = {
      view: {
        dom: { querySelectorAll: () => [liveLink] },
        posAtDOM: (node: unknown) => (node === liveLink ? 7 : -1),
        state: { doc: { nodeAt: () => ({ marks: [mark] }) } }
      }
    } as unknown as Editor

    const result = buildPreviewOptionsFromAnchor({
      editor,
      link: detachedLink
    })

    expect(result.link).toBe(liveLink)
    expect(result.nodePos).toBe(7)
    expect(result.attrs.href).toBe('https://example.test')
  })

  it('prefers the anchor at nodePos over the first duplicate href/text match', () => {
    const detachedLink = anchor({
      href: 'https://duplicate.test',
      text: 'Duplicate',
      isConnected: false
    })
    const firstDuplicate = anchor({
      href: 'https://duplicate.test',
      text: 'Duplicate',
      isConnected: true
    })
    const positionedDuplicate = anchor({
      href: 'https://duplicate.test',
      text: 'Duplicate',
      isConnected: true
    })
    const mark = {
      type: { name: 'hyperlink' },
      attrs: {
        href: 'https://duplicate.test',
        target: null,
        rel: null,
        class: null,
        title: null,
        image: null
      }
    }
    const editor = {
      view: {
        dom: {
          contains: () => true,
          querySelectorAll: () => [firstDuplicate, positionedDuplicate]
        },
        domAtPos: () => ({ node: positionedDuplicate }),
        posAtDOM: (node: unknown) => (node === positionedDuplicate ? 9 : -1),
        state: { doc: { nodeAt: () => ({ marks: [mark] }) } }
      }
    } as unknown as Editor

    const result = buildPreviewOptionsFromAnchor({
      editor,
      link: detachedLink,
      nodePos: 9
    })

    expect(result.link).toBe(positionedDuplicate)
    expect(result.nodePos).toBe(9)
  })

  it('falls back to the anchor href when ProseMirror cannot resolve a position', () => {
    const link = anchor({ href: '/fallback', text: 'Detached', isConnected: false })
    const editor = {
      view: {
        dom: { querySelectorAll: () => [] },
        posAtDOM: () => {
          throw new RangeError('detached')
        },
        state: { doc: { nodeAt: () => null } }
      }
    } as unknown as Editor

    const result = buildPreviewOptionsFromAnchor({ editor, link })

    expect(result.link).toBe(link)
    expect(result.nodePos).toBe(-1)
    expect(result.attrs.href).toBe('/fallback')
  })
})
