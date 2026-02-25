/**
 * Unit tests for decorationHelpers.ts
 *
 * Tests the optimization layer that decides whether to rebuild decorations
 * from scratch or incrementally map them after a transaction.
 *
 * These are pure functions operating on ProseMirror data structures —
 * ideal candidates for fast, deterministic unit tests.
 */

import { EditorState } from '@tiptap/pm/state'
import { DecorationSet } from '@tiptap/pm/view'

import {
  buildDoc,
  contentWrapper,
  createTestSchema,
  heading,
  paragraph
} from '../testUtils/testSchema'
import {
  createDecorationPluginProps,
  createDecorationPluginState,
  createOptimizedDecorationApply
} from '../plugins/decorationHelpers'

// ---------------------------------------------------------------------------
// Schema + fixtures
// ---------------------------------------------------------------------------

const schema = createTestSchema()

const simpleDoc = () => buildDoc(schema, [heading(schema, 1, 'Title', [paragraph(schema, 'body')])])

const twoSectionDoc = () =>
  buildDoc(schema, [
    heading(schema, 1, 'First', [paragraph(schema, 'a')]),
    heading(schema, 1, 'Second', [paragraph(schema, 'b')])
  ])

// A mock buildDecorations that tracks invocation count
const createMockBuilder = () => {
  let callCount = 0
  const fn = (doc) => {
    callCount++
    return DecorationSet.empty
  }
  return { fn, getCallCount: () => callCount }
}

// ---------------------------------------------------------------------------
// createOptimizedDecorationApply
// ---------------------------------------------------------------------------

describe('createOptimizedDecorationApply', () => {
  it('returns old decorations when document has not changed', () => {
    const { fn } = createMockBuilder()
    const apply = createOptimizedDecorationApply(fn, ['heading'])

    const doc = simpleDoc()
    const state = EditorState.create({ doc, schema })
    // Transaction that did NOT change the doc (e.g. selection-only)
    const tr = state.tr.setSelection(state.selection)

    const oldDecos = DecorationSet.empty
    const result = apply(tr, oldDecos)

    expect(result).toBe(oldDecos) // exact same reference — no rebuild
  })

  it('maps decorations when doc changed but no target node types in steps', () => {
    const { fn, getCallCount } = createMockBuilder()
    const apply = createOptimizedDecorationApply(fn, ['heading'])

    const doc = simpleDoc()
    const state = EditorState.create({ doc, schema })

    // Insert text inside a paragraph — no heading node in the slice
    const textPos = findFirstParagraphTextPos(doc)
    const tr = state.tr.insertText('hello', textPos)

    const oldDecos = DecorationSet.empty
    const result = apply(tr, oldDecos)

    // Should NOT have called the full rebuild builder
    // (mapped decorations are used instead)
    // Since old and mapped are both empty, count stays 0
    expect(getCallCount()).toBe(0)
  })

  it('rebuilds decorations when step contains a target node type', () => {
    const { fn, getCallCount } = createMockBuilder()
    const apply = createOptimizedDecorationApply(fn, ['heading'])

    const doc = twoSectionDoc()
    const state = EditorState.create({ doc, schema })

    // Insert a new heading node — slice DOES contain 'heading'
    const newHeading = heading(schema, 1, 'Third', [paragraph(schema, 'c')])
    const insertPos = doc.content.size
    const tr = state.tr.insert(insertPos, newHeading)

    const oldDecos = DecorationSet.empty
    apply(tr, oldDecos)

    expect(getCallCount()).toBe(1)
  })

  it('rebuilds when a target node is deleted (decoration count changes)', () => {
    const { fn, getCallCount } = createMockBuilder()
    const apply = createOptimizedDecorationApply(fn, ['contentWrapper'])

    const doc = twoSectionDoc()
    const state = EditorState.create({ doc, schema })

    // Build initial decorations with one per contentWrapper
    const buildInitialDecos = (d) => {
      const { Decoration } = require('@tiptap/pm/view')
      const decos = []
      d.descendants((node, pos) => {
        if (node.type.name === 'contentWrapper') {
          decos.push(Decoration.widget(pos, document.createElement('div')))
        }
      })
      return DecorationSet.create(d, decos)
    }

    const oldDecos = buildInitialDecos(doc)

    // Delete the second section entirely
    const secondStart = doc.child(1) // second heading
    const secondPos = doc.content.size - secondStart.nodeSize
    const tr = state.tr.delete(secondPos, doc.content.size)

    apply(tr, oldDecos)

    // Rebuild should have been triggered because decoration count dropped
    expect(getCallCount()).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// createDecorationPluginState
// ---------------------------------------------------------------------------

describe('createDecorationPluginState', () => {
  it('init calls the builder with the document', () => {
    const { fn, getCallCount } = createMockBuilder()
    const pluginState = createDecorationPluginState(fn, ['heading'])

    const doc = simpleDoc()
    pluginState.init(null, { doc })

    expect(getCallCount()).toBe(1)
  })

  it('init calls optional callback when provided', () => {
    const { fn } = createMockBuilder()
    let callbackCalled = false
    const pluginState = createDecorationPluginState(fn, ['heading'], () => {
      callbackCalled = true
    })

    pluginState.init(null, { doc: simpleDoc() })

    expect(callbackCalled).toBe(true)
  })

  it('apply delegates to createOptimizedDecorationApply', () => {
    const { fn } = createMockBuilder()
    const pluginState = createDecorationPluginState(fn, ['heading'])

    const doc = simpleDoc()
    const state = EditorState.create({ doc, schema })
    const tr = state.tr // no-change transaction

    const oldDecos = DecorationSet.empty
    const result = pluginState.apply(tr, oldDecos)

    // No doc change → returns old decos
    expect(result).toBe(oldDecos)
  })
})

// ---------------------------------------------------------------------------
// createDecorationPluginProps
// ---------------------------------------------------------------------------

describe('createDecorationPluginProps', () => {
  it('returns an object with a decorations function', () => {
    const props = createDecorationPluginProps()

    expect(typeof props.decorations).toBe('function')
  })

  it('decorations calls this.getState with the editor state', () => {
    const props = createDecorationPluginProps()
    const mockState = { doc: simpleDoc() }
    const expectedDecos = DecorationSet.empty

    // Simulate the plugin `this` context
    const context = {
      getState: jest.fn(() => expectedDecos)
    }

    const result = props.decorations.call(context, mockState)

    expect(context.getState).toHaveBeenCalledWith(mockState)
    expect(result).toBe(expectedDecos)
  })
})

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function findFirstParagraphTextPos(doc) {
  let pos = -1
  doc.descendants((node, nodePos) => {
    if (pos !== -1) return false
    if (node.type.name === 'paragraph') {
      pos = nodePos + 1 // inside the paragraph
      return false
    }
    return true
  })
  return pos
}
