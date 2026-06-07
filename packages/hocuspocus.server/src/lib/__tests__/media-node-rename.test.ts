import { TiptapTransformer } from '@hocuspocus/transformer'
import { Node } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'bun:test'
import * as Y from 'yjs'

import { planMediaRenameRow } from '../nested-flat-migration'
import { hasLegacyMediaNodes, renameMediaNodes } from '../schema-migration'

/** Legacy PascalCase node, used only to encode pre-2.0 stored bytes for the
 * round-trip test (the production schema no longer has these names). */
const LegacyImage = Node.create({
  name: 'Image',
  group: 'block',
  atom: true,
  addAttributes: () => ({ src: { default: null }, keyId: { default: null } })
})

const LegacyTwitter = Node.create({
  name: 'Twitter',
  group: 'block',
  atom: true,
  addAttributes: () => ({ src: { default: null }, keyId: { default: null } })
})

const LEGACY = ['Image', 'Video', 'Audio', 'Youtube', 'Vimeo', 'SoundCloud', 'Twitter'] as const
const CAMEL: Record<(typeof LEGACY)[number], string> = {
  Image: 'image',
  Video: 'video',
  Audio: 'audio',
  Youtube: 'youtube',
  Vimeo: 'vimeo',
  SoundCloud: 'soundcloud',
  Twitter: 'x'
}

describe('hasLegacyMediaNodes', () => {
  it('detects each legacy PascalCase media type at top level', () => {
    for (const type of LEGACY) {
      const doc = { type: 'doc', content: [{ type, attrs: { keyId: 'a' } }] }
      expect(hasLegacyMediaNodes(doc as any)).toBe(true)
    }
  })

  it('detects legacy media nested inside other blocks', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            { type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'Youtube' }] }] }
          ]
        }
      ]
    }
    expect(hasLegacyMediaNodes(doc as any)).toBe(true)
  })

  it('returns false for an all-camelCase / non-media document', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Hi' }] },
        { type: 'image', attrs: { src: 'x.png' } },
        { type: 'paragraph' }
      ]
    }
    expect(hasLegacyMediaNodes(doc as any)).toBe(false)
  })

  it('returns false for an empty doc', () => {
    expect(hasLegacyMediaNodes({ type: 'doc' } as any)).toBe(false)
  })
})

describe('renameMediaNodes', () => {
  it('renames every legacy media type to camelCase, preserving attrs', () => {
    const doc = {
      type: 'doc',
      content: LEGACY.map((type) => ({ type, attrs: { keyId: `${type}-1`, src: 'x' } }))
    }
    const out = renameMediaNodes(doc as any)
    out.content!.forEach((node, i) => {
      expect(node.type).toBe(CAMEL[LEGACY[i]])
      expect(node.attrs).toEqual({ keyId: `${LEGACY[i]}-1`, src: 'x' })
    })
  })

  it('renames media nested inside containers', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'tableCell', content: [{ type: 'Vimeo', attrs: { src: 'v' } }] }]
    }
    const out = renameMediaNodes(doc as any)
    expect(out.content![0].content![0].type).toBe('vimeo')
  })

  it('leaves non-media nodes and text untouched', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'keep me' }] },
        { type: 'heading', attrs: { level: 2 } }
      ]
    }
    expect(renameMediaNodes(doc as any)).toEqual(doc)
  })

  it('is idempotent (already-renamed docs pass through unchanged)', () => {
    const doc = { type: 'doc', content: [{ type: 'image' }, { type: 'youtube' }] }
    const once = renameMediaNodes(doc as any)
    const twice = renameMediaNodes(once)
    expect(twice).toEqual(once)
    expect(hasLegacyMediaNodes(twice)).toBe(false)
  })
})

describe('planMediaRenameRow — real Yjs round-trip', () => {
  it('decodes legacy PascalCase bytes, renames, re-encodes cleanly', () => {
    // Encode a doc with a legacy `Image` node using a throwaway legacy schema
    // (production no longer registers PascalCase names).
    const legacyDoc = {
      type: 'doc',
      content: [
        { type: 'Image', attrs: { src: 'https://example.com/a.png', keyId: 'k1' } },
        { type: 'paragraph', content: [{ type: 'text', text: 'caption' }] }
      ]
    }
    const legacyYdoc = TiptapTransformer.toYdoc(legacyDoc as any, 'default', [
      StarterKit,
      LegacyImage
    ])
    const bytes = Y.encodeStateAsUpdate(legacyYdoc)

    const plan = planMediaRenameRow(bytes)
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.plan.action).toBe('update')
    if (plan.plan.action !== 'update') return

    expect(plan.plan.bytes.byteLength).toBeGreaterThan(0)

    // Decode the migrated bytes — no legacy media type may survive.
    const out = new Y.Doc()
    Y.applyUpdate(out, plan.plan.bytes)
    const json = TiptapTransformer.fromYdoc(out, 'default') as any
    expect(hasLegacyMediaNodes(json)).toBe(false)
    expect(JSON.stringify(json)).toContain('"image"')
    expect(JSON.stringify(json)).not.toContain('"Image"')
  })

  it('renames a legacy `Twitter` node to `x` through a real Yjs round-trip', () => {
    // Twitter→x is the only non-lowercasing rename and the highest data-loss risk.
    const legacyDoc = {
      type: 'doc',
      content: [
        { type: 'Twitter', attrs: { src: 'https://x.com/u/status/1', keyId: 'k1' } },
        { type: 'paragraph', content: [{ type: 'text', text: 'caption' }] }
      ]
    }
    const legacyYdoc = TiptapTransformer.toYdoc(legacyDoc as any, 'default', [
      StarterKit,
      LegacyTwitter
    ])

    const plan = planMediaRenameRow(Y.encodeStateAsUpdate(legacyYdoc))
    expect(plan.ok).toBe(true)
    if (!plan.ok || plan.plan.action !== 'update') return

    const out = new Y.Doc()
    Y.applyUpdate(out, plan.plan.bytes)
    const json = TiptapTransformer.fromYdoc(out, 'default') as any
    expect(hasLegacyMediaNodes(json)).toBe(false)
    expect(JSON.stringify(json)).toContain('"x"')
    expect(JSON.stringify(json)).not.toContain('"Twitter"')
    // The stored `src` attr must survive the rename.
    expect(JSON.stringify(json)).toContain('https://x.com/u/status/1')
  })

  it('skips (no update) when there are no legacy media nodes', () => {
    const cleanDoc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'plain' }] }]
    }
    const ydoc = TiptapTransformer.toYdoc(cleanDoc as any, 'default', [StarterKit])
    const plan = planMediaRenameRow(Y.encodeStateAsUpdate(ydoc))
    expect(plan.ok).toBe(true)
    if (plan.ok) expect(plan.plan.action).toBe('skip')
  })
})
