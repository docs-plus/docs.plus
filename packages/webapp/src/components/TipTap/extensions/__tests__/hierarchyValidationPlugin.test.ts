import { EditorState } from '@tiptap/pm/state'
import { TRANSACTION_META } from '@types'

import { createHierarchyValidationPlugin } from '../plugins/hierarchyValidationPlugin'
import { hasHierarchyViolations } from '../validateHeadingHierarchy'
import {
  buildDoc,
  createTestSchema,
  getFirstTextPos,
  heading,
  paragraph
} from '../testUtils/testSchema'

describe('createHierarchyValidationPlugin', () => {
  const schema = createTestSchema()

  const makeValidDoc = () =>
    buildDoc(schema, [
      heading(schema, 1, 'Root', [heading(schema, 2, 'H2', [paragraph(schema, 'body')])])
    ])

  const makeInvalidDoc = () =>
    buildDoc(schema, [
      heading(schema, 1, 'Root', [
        heading(schema, 2, 'H2', [
          paragraph(schema, 'body'),
          heading(schema, 1, 'Nested H1', [paragraph(schema, 'nested')])
        ])
      ])
    ])

  const makeDocChangedTransaction = (state: EditorState) => {
    const textPos = getFirstTextPos(state.doc)
    return state.tr.insertText('x', textPos)
  }

  const makeHierarchyAffectingTransaction = (state: EditorState) =>
    state.tr.insert(
      state.doc.content.size,
      heading(schema, 1, 'Inserted Root', [paragraph(schema, 'inserted body')])
    )

  it('returns null when there are no document changes', () => {
    const plugin = createHierarchyValidationPlugin()
    const oldState = EditorState.create({ schema, doc: makeValidDoc() })
    const newState = EditorState.create({ schema, doc: makeInvalidDoc() })

    const result = plugin.spec.appendTransaction?.([oldState.tr], oldState, newState)
    expect(result).toBeNull()
  })

  it('returns null for hierarchy fix transactions to prevent loops', () => {
    const plugin = createHierarchyValidationPlugin()
    const oldState = EditorState.create({ schema, doc: makeValidDoc() })
    const newState = EditorState.create({ schema, doc: makeInvalidDoc() })

    const tr = makeHierarchyAffectingTransaction(oldState)
    tr.setMeta('hierarchyValidationFix', true)

    const result = plugin.spec.appendTransaction?.([tr], oldState, newState)
    expect(result).toBeNull()
  })

  it('returns null for fold/unfold meta transactions', () => {
    const plugin = createHierarchyValidationPlugin()
    const oldState = EditorState.create({ schema, doc: makeValidDoc() })
    const newState = EditorState.create({ schema, doc: makeInvalidDoc() })

    const tr = makeHierarchyAffectingTransaction(oldState)
    tr.setMeta(TRANSACTION_META.ADD_TO_HISTORY, false)
    tr.setMeta(TRANSACTION_META.FOLD_AND_UNFOLD, true)

    const result = plugin.spec.appendTransaction?.([tr], oldState, newState)
    expect(result).toBeNull()
  })

  it('appends a fix transaction when hierarchy violations exist', () => {
    const plugin = createHierarchyValidationPlugin()
    const oldState = EditorState.create({ schema, doc: makeValidDoc() })
    const newState = EditorState.create({ schema, doc: makeInvalidDoc() })

    expect(hasHierarchyViolations(newState.doc)).toBe(true)

    const tr = makeHierarchyAffectingTransaction(oldState)
    const fixTr = plugin.spec.appendTransaction?.([tr], oldState, newState)

    expect(fixTr).not.toBeNull()
    expect(fixTr?.getMeta('hierarchyValidationFix')).toBe(true)
    expect(fixTr?.getMeta(TRANSACTION_META.ADD_TO_HISTORY)).toBe(false)

    const finalState = newState.apply(fixTr!)
    expect(hasHierarchyViolations(finalState.doc)).toBe(false)
  })

  it('does not append when the new document is already valid', () => {
    const plugin = createHierarchyValidationPlugin()
    const oldState = EditorState.create({ schema, doc: makeValidDoc() })
    const newState = EditorState.create({ schema, doc: makeValidDoc() })

    const tr = makeHierarchyAffectingTransaction(oldState)
    const result = plugin.spec.appendTransaction?.([tr], oldState, newState)
    expect(result).toBeNull()
  })

  it('returns null on plain text edits because fast-path marks them as hierarchy-safe', () => {
    const plugin = createHierarchyValidationPlugin()
    const oldState = EditorState.create({ schema, doc: makeValidDoc() })
    const newState = oldState.apply(makeDocChangedTransaction(oldState))
    const tr = makeDocChangedTransaction(oldState)

    const result = plugin.spec.appendTransaction?.([tr], oldState, newState)
    expect(result).toBeNull()
  })

  it('still heals an invalid document on first text-only edit (initial safety scan)', () => {
    const plugin = createHierarchyValidationPlugin()
    const oldState = EditorState.create({ schema, doc: makeInvalidDoc() })
    const textPos = getFirstTextPos(oldState.doc)
    const tr = oldState.tr.insertText('x', textPos)
    const newState = oldState.apply(tr)

    const fixTr = plugin.spec.appendTransaction?.([tr], oldState, newState)
    expect(fixTr).not.toBeNull()

    const finalState = newState.apply(fixTr!)
    expect(hasHierarchyViolations(finalState.doc)).toBe(false)
  })
})
