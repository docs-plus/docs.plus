import { EditorState, TextSelection } from '@tiptap/pm/state'

import { insertRemainingHeadings } from '../helper'
import { createHierarchyValidationPlugin } from '../plugins/hierarchyValidationPlugin'
import {
  buildDoc,
  createTestSchema,
  getHeadingSnapshot,
  heading,
  paragraph
} from '../testUtils/testSchema'

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

const findTextPos = (doc, needle) => {
  let found = -1
  doc.descendants((node, pos) => {
    if (found !== -1) return false
    if (node.isText && node.text?.includes(needle)) {
      found = pos
      return false
    }
    return true
  })
  if (found === -1) throw new Error(`Could not find text "${needle}" in document`)
  return found
}

const buildLargeDoc = (schema, rootCount, childrenPerRoot) => {
  const roots = Array.from({ length: rootCount }, (_, rootIndex) =>
    heading(schema, 1, `Root ${rootIndex}`, [
      paragraph(schema, `root-${rootIndex}-body`),
      ...Array.from({ length: childrenPerRoot }, (_, childIndex) =>
        heading(schema, 2, `R${rootIndex}-H2-${childIndex}`, [
          paragraph(schema, `r${rootIndex}-h2-${childIndex}-body`)
        ])
      )
    ])
  )

  return buildDoc(schema, roots)
}

const buildPastedHeadingsJson = (schema, count) =>
  Array.from({ length: count }, (_, index) => {
    const level = index % 3 === 0 ? 2 : 3
    return heading(schema, level, `Pasted-${index}`, [
      paragraph(schema, `Pasted body ${index}`)
    ]).toJSON()
  })

describe('heading map performance guards', () => {
  const schema = createTestSchema()

  it('benchmarks insertRemainingHeadings with one heading-window scan per inserted heading', () => {
    const doc = buildLargeDoc(schema, 10, 20)
    const initialHeadingCount = getHeadingSnapshot(doc).length

    let state = EditorState.create({ schema, doc })
    const caretPos = findTextPos(doc, 'root-0-body')
    state = state.apply(state.tr.setSelection(TextSelection.create(doc, caretPos)))

    const { $from, $to } = state.selection
    const titleStartPos = $from.start(1) - 1
    const titleEndPos = $to.end(1)
    const tr = state.tr

    const pastedHeadings = buildPastedHeadingsJson(schema, 40)
    const traversalMetrics = {
      headingWindowScans: 0,
      headingNodesVisited: 0,
      topLevelBoundaryScans: 0
    }

    const startTime = now()
    const handled = insertRemainingHeadings({
      state,
      tr,
      headings: pastedHeadings,
      titleStartPos,
      titleEndPos,
      prevHStartPos: 0,
      traversalMetrics
    })
    const elapsedMs = now() - startTime

    expect(handled).toBe(true)
    expect(traversalMetrics.headingWindowScans).toBe(pastedHeadings.length)
    expect(traversalMetrics.topLevelBoundaryScans).toBe(0)
    // Benchmark-style budget guard to catch accidental O(n^2) regressions.
    expect(elapsedMs).toBeLessThan(1500)
    expect(getHeadingSnapshot(tr.doc).length).toBe(initialHeadingCount + pastedHeadings.length)
  })

  it('CR-2: insertHeadingsByNodeBlocks scales for large paste (100 headings)', () => {
    const doc = buildLargeDoc(schema, 5, 10)
    const initialHeadingCount = getHeadingSnapshot(doc).length

    let state = EditorState.create({ schema, doc })
    const caretPos = findTextPos(doc, 'root-0-body')
    state = state.apply(state.tr.setSelection(TextSelection.create(doc, caretPos)))

    const { $from, $to } = state.selection
    const titleStartPos = $from.start(1) - 1
    const tr = state.tr
    const from = state.selection.from

    const pastedCount = 100
    const pastedNodes = Array.from({ length: pastedCount }, (_, i) => {
      const level = (i % 4) + 2 // levels 2-5 cycling
      return heading(schema, level, `Batch-${i}`, [paragraph(schema, `batch body ${i}`)])
    })

    const lastH1Inserted = {
      startBlockPos: titleStartPos,
      endBlockPos: $to.end(1)
    }

    const { insertHeadingsByNodeBlocks } = require('../helper/headingMap')

    const startTime = now()
    insertHeadingsByNodeBlocks(tr, pastedNodes, from, lastH1Inserted, from, titleStartPos, 0)
    const elapsedMs = now() - startTime

    const finalHeadingCount = getHeadingSnapshot(tr.doc).length

    expect(finalHeadingCount).toBe(initialHeadingCount + pastedCount)
    // CR-2 budget: 100 headings should complete well under 2 seconds
    // thanks to incremental heading-map caching.
    expect(elapsedMs).toBeLessThan(2000)
  })

  it('benchmarks large-doc plain-text edits on hierarchy fast-path after initial validation', () => {
    const plugin = createHierarchyValidationPlugin()

    // Warm the plugin so the one-time initial validation pass has already run.
    const warmDoc = buildLargeDoc(schema, 2, 4)
    const warmState = EditorState.create({ schema, doc: warmDoc })
    const warmPos = findTextPos(warmDoc, 'root-0-body')
    const warmTr = warmState.tr.insertText('w', warmPos)
    const warmNewState = warmState.apply(warmTr)
    plugin.spec.appendTransaction?.([warmTr], warmState, warmNewState)

    const largeDoc = buildLargeDoc(schema, 16, 28)
    const oldState = EditorState.create({ schema, doc: largeDoc })
    const textPos = findTextPos(largeDoc, 'root-0-body')
    const tr = oldState.tr.insertText('x', textPos)
    const newState = oldState.apply(tr)

    const startTime = now()
    const result = plugin.spec.appendTransaction?.([tr], oldState, newState)
    const elapsedMs = now() - startTime

    expect(result).toBeNull()
    // Budget guard: plain-text edits should remain fast even on large documents.
    expect(elapsedMs).toBeLessThan(750)
  })
})
