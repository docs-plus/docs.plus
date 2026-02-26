/**
 * Unit tests for the pure data-extraction logic in crinklePlugin.ts.
 *
 * The crinkle plugin creates fold/unfold decorations for contentWrapper nodes.
 * The DOM event handling and decoration rendering are browser concerns tested by E2E.
 * Here we test the document-traversal function that finds contentWrapper positions.
 *
 * Since `extractContentWrapperBlocks` is not exported, we test it indirectly
 * through the full plugin via buildDecorations → DecorationSet positions.
 */

import { Plugin } from '@tiptap/pm/state'
import { DecorationSet } from '@tiptap/pm/view'

import { buildDoc, createTestSchema, heading, paragraph } from '../testUtils/testSchema'

// We test through the public createCrinklePlugin entry point
import { createCrinklePlugin } from '../plugins/crinklePlugin'

// ---------------------------------------------------------------------------
// Schema + fixtures
// ---------------------------------------------------------------------------

const schema = createTestSchema()

// ---------------------------------------------------------------------------
// createCrinklePlugin structure
// ---------------------------------------------------------------------------

describe('createCrinklePlugin', () => {
  it('returns a ProseMirror Plugin instance', () => {
    const plugin = createCrinklePlugin()
    expect(plugin).toBeInstanceOf(Plugin)
  })

  it('plugin key is "crinkle"', () => {
    const plugin = createCrinklePlugin()
    // PluginKey.key has format "pluginName$"
    expect(plugin.spec.key?.key).toContain('crinkle')
  })

  it('plugin state init produces DecorationSet for a simple document', () => {
    const plugin = createCrinklePlugin()
    const doc = buildDoc(schema, [heading(schema, 1, 'Root', [paragraph(schema, 'body')])])

    // Call state.init to build initial decorations
    const decos = plugin.spec.state?.init(null, { doc })

    // Should produce at least one decoration for the contentWrapper
    expect(decos).toBeDefined()
    // DecorationSet.find() returns an array of Decoration objects
    const found = decos.find()
    // One heading → one contentWrapper → one crinkle decoration
    expect(found.length).toBe(1)
  })

  it('produces one decoration per contentWrapper in multi-section doc', () => {
    const plugin = createCrinklePlugin()
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Section A', [
        paragraph(schema, 'body a'),
        heading(schema, 2, 'Sub A1', [paragraph(schema, 'deep')])
      ]),
      heading(schema, 1, 'Section B', [paragraph(schema, 'body b')])
    ])

    const decos = plugin.spec.state?.init(null, { doc })
    const found = decos.find()

    // 4 headings total (Section A, Sub A1, Section B) — wait:
    // heading(1, 'Section A') has contentWrapper
    //   heading(2, 'Sub A1') has contentWrapper
    // heading(1, 'Section B') has contentWrapper
    // Total: 3 contentWrapper nodes → 3 decorations
    expect(found.length).toBe(3)
  })

  it('deeply nested headings produce one decoration per contentWrapper', () => {
    const plugin = createCrinklePlugin()
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Root', [
        heading(schema, 2, 'L2', [
          heading(schema, 3, 'L3', [heading(schema, 4, 'L4', [paragraph(schema, 'deep')])])
        ])
      ])
    ])

    const decos = plugin.spec.state?.init(null, { doc })
    const found = decos.find()

    // Root(cw) > L2(cw) > L3(cw) > L4(cw) = 4 contentWrappers
    expect(found.length).toBe(4)
  })
})
