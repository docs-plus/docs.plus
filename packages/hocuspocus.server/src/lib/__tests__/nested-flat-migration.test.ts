import { describe, expect, it } from 'bun:test'
import * as Y from 'yjs'

import { planRow, pmJsonToYdocBytes, ydocToPmJson } from '../nested-flat-migration'
import { isOldSchema, transformNestedToFlat } from '../schema-migration'

describe('nested-flat-migration planRow', () => {
  it('skips rows that are already flat (round-trip bytes)', () => {
    const flatDoc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, 'toc-id': 'abc' },
          content: [{ type: 'text', text: 'Title' }]
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'Body' }] }
      ]
    }

    const bytes = pmJsonToYdocBytes(flatDoc as unknown as Record<string, unknown>)
    const r = planRow(bytes)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.plan.action).toBe('skip')
  })

  it('after transformNestedToFlat + encode, planRow skips (Yjs payload is already flat)', () => {
    const nested = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, id: 'title-id' },
          content: [
            {
              type: 'contentHeading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: 'My Title' }]
            },
            {
              type: 'contentWrapper',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body' }] }]
            }
          ]
        }
      ]
    }

    expect(isOldSchema(nested as any)).toBe(true)
    const flat = transformNestedToFlat(nested as any)
    expect(isOldSchema(flat as any)).toBe(false)

    const bytes = pmJsonToYdocBytes(flat as unknown as Record<string, unknown>)
    const back = ydocToPmJson(bytes)
    expect(back.ok).toBe(true)
    if (back.ok) expect(isOldSchema(back.json as any)).toBe(false)

    const r = planRow(bytes)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.plan.action).toBe('skip')
  })
})

describe('ydocToPmJson', () => {
  it('decodes minimal empty Y doc update', () => {
    const empty = Y.encodeStateAsUpdate(new Y.Doc())
    const r = ydocToPmJson(empty)
    expect(r.ok).toBe(true)
  })
})
