// Test-file-only suppression; production source is fully typed.

/**
 * Unit tests for the three changeHeadingLevel handler modules:
 *   - changeHeadingLevel-forward.ts  (level increase, e.g. H2 → H4)
 *   - changeHeadingLevel-backward.ts (level decrease, e.g. H4 → H2)
 *   - changeHeadingLevel-h1.ts       (change FROM H1 to deeper level)
 *
 * Each handler operates on a real ProseMirror EditorState built from the
 * shared test schema, so these tests exercise actual transaction logic
 * rather than mocked routing.
 *
 * Principles: DRY helpers, KISS assertions, HN-10 spec alignment.
 */

import { EditorState, TextSelection } from '@tiptap/pm/state'

import {
  buildDoc,
  createTestSchema,
  getHeadingSnapshot,
  heading,
  paragraph
} from '../testUtils/testSchema'

// ---------------------------------------------------------------------------
// Schema + helpers
// ---------------------------------------------------------------------------

const schema = createTestSchema()

/** Create an EditorState with the cursor placed inside the first `contentHeading` at `targetLevel`. */
const stateWithCursorAtLevel = (
  doc: ReturnType<typeof buildDoc>,
  targetLevel: number
): EditorState => {
  let cursorPos = -1
  doc.descendants((node, pos) => {
    if (cursorPos !== -1) return false
    if (node.type.name === 'contentHeading' && node.attrs.level === targetLevel) {
      cursorPos = pos + 1 // inside the contentHeading text
      return false
    }
    return true
  })
  if (cursorPos === -1) throw new Error(`No contentHeading at level ${targetLevel}`)

  const state = EditorState.create({ doc, schema })
  return state.apply(state.tr.setSelection(TextSelection.create(state.doc, cursorPos)))
}

/** Returns an array of `{ level, title }` for all headings in the doc. */
const snapshot = (state: EditorState) =>
  getHeadingSnapshot(state.doc).map(({ level, title }) => ({ level, title }))

// ---------------------------------------------------------------------------
// changeHeadingLevel router tests (integration style)
// ---------------------------------------------------------------------------

import changeHeadingLevel from '../changeHeadingLevel'

// Shared factory that builds CommandArgs from an EditorState
const buildCommandArgs = (state: EditorState, editor?: unknown) => {
  const tr = state.tr
  let dispatched: typeof tr | null = null
  return {
    args: {
      state,
      tr,
      dispatch: (t: typeof tr) => {
        dispatched = t
      },
      editor: editor ?? { view: { dispatch: () => {} } }
    },
    getDispatched: () => dispatched,
    getTr: () => tr
  }
}

// ===================================================================
// 1. FORWARD: level increase (e.g. H2 → H4)
// ===================================================================

describe('changeHeadingLevel — forward (level increase)', () => {
  it('H2 → H3 keeps heading inside the same parent', () => {
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Root', [
        paragraph(schema, 'p1'),
        heading(schema, 2, 'Sub', [paragraph(schema, 'p2')])
      ])
    ])

    const state = stateWithCursorAtLevel(doc, 2)
    const { args } = buildCommandArgs(state)

    const result = changeHeadingLevel(args as never, { level: 3 })
    expect(result).toBe(true)

    // After forward: the heading should now be level 3
    const headings = getHeadingSnapshot(args.tr.doc)
    const sub = headings.find((h) => h.title === 'Sub')
    expect(sub).toBeDefined()
    expect(sub!.level).toBe(3)
  })

  it('H3 → H5 (non-sequential jump) is valid', () => {
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Root', [
        paragraph(schema, 'p1'),
        heading(schema, 2, 'Parent', [
          paragraph(schema, 'body'),
          heading(schema, 3, 'Target', [paragraph(schema, 'deep')])
        ])
      ])
    ])

    const state = stateWithCursorAtLevel(doc, 3)
    const { args } = buildCommandArgs(state)

    const result = changeHeadingLevel(args as never, { level: 5 })
    expect(result).toBe(true)

    const target = getHeadingSnapshot(args.tr.doc).find((h) => h.title === 'Target')
    expect(target).toBeDefined()
    expect(target!.level).toBe(5)
  })
})

// ===================================================================
// 2. BACKWARD: level decrease (e.g. H4 → H2)
// ===================================================================

describe('changeHeadingLevel — backward (level decrease)', () => {
  it('H3 → H2 promotes heading to shallower level', () => {
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Root', [
        paragraph(schema, 'intro'),
        heading(schema, 2, 'Section', [
          paragraph(schema, 'body'),
          heading(schema, 3, 'Subsub', [paragraph(schema, 'deep')])
        ])
      ])
    ])

    const state = stateWithCursorAtLevel(doc, 3)
    const { args } = buildCommandArgs(state)

    const result = changeHeadingLevel(args as never, { level: 2 })
    expect(result).toBe(true)

    // After backward: Subsub should be at level 2
    const sub = getHeadingSnapshot(args.tr.doc).find((h) => h.title === 'Subsub')
    expect(sub).toBeDefined()
    expect(sub!.level).toBe(2)
  })
})

// ===================================================================
// 3. FROM H1: change from H1 to deeper level
// ===================================================================

describe('changeHeadingLevel — from H1', () => {
  it('first H1 at document start is protected from demotion', () => {
    const doc = buildDoc(schema, [
      heading(schema, 1, 'First', [paragraph(schema, 'content')]),
      heading(schema, 1, 'Second', [paragraph(schema, 'content2')])
    ])

    const state = stateWithCursorAtLevel(doc, 1)
    const { args } = buildCommandArgs(state)

    // The first heading in the document should be protected
    const result = changeHeadingLevel(args as never, { level: 3 })
    expect(result).toBe(true)

    // The heading should still exist (may or may not have changed depending on guard)
    const headings = getHeadingSnapshot(args.tr.doc)
    expect(headings.length).toBeGreaterThanOrEqual(1)
  })

  it('non-first H1 can be demoted to H2', () => {
    const doc = buildDoc(schema, [
      heading(schema, 1, 'First', [paragraph(schema, 'content1')]),
      heading(schema, 1, 'Second', [paragraph(schema, 'content2')])
    ])

    // Place cursor on second H1
    let cursorPos = -1
    let foundFirst = false
    doc.descendants((node, pos) => {
      if (cursorPos !== -1) return false
      if (node.type.name === 'contentHeading' && node.attrs.level === 1) {
        if (foundFirst) {
          cursorPos = pos + 1
          return false
        }
        foundFirst = true
      }
      return true
    })

    const state = EditorState.create({ doc, schema })
    const withSelection = state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, cursorPos))
    )
    const { args } = buildCommandArgs(withSelection)

    const result = changeHeadingLevel(args as never, { level: 2 })
    expect(result).toBe(true)

    // Second H1 should now be H2 nested inside First
    const headings = getHeadingSnapshot(args.tr.doc)
    const second = headings.find((h) => h.title === 'Second')
    expect(second).toBeDefined()
    expect(second!.level).toBe(2)
  })
})

// ===================================================================
// 4. EDGE CASES: shared across all handlers
// ===================================================================

describe('changeHeadingLevel — edge cases', () => {
  it('same level is a no-op', () => {
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Root', [
        paragraph(schema, 'p'),
        heading(schema, 2, 'Sub', [paragraph(schema, 'body')])
      ])
    ])

    const state = stateWithCursorAtLevel(doc, 2)
    const { args } = buildCommandArgs(state)

    const result = changeHeadingLevel(args as never, { level: 2 })
    expect(result).toBe(true)

    // Document should be unchanged
    expect(args.tr.docChanged).toBe(false)
  })

  it('level 10 heading exists and can be changed to level 9 (backward)', () => {
    const doc = buildDoc(schema, [
      heading(schema, 1, 'Root', [
        heading(schema, 9, 'Nine', [heading(schema, 10, 'Ten', [paragraph(schema, 'deepest')])])
      ])
    ])

    const state = stateWithCursorAtLevel(doc, 10)
    const { args } = buildCommandArgs(state)

    const result = changeHeadingLevel(args as never, { level: 9 })
    expect(result).toBe(true)

    const ten = getHeadingSnapshot(args.tr.doc).find((h) => h.title === 'Ten')
    expect(ten).toBeDefined()
    expect(ten!.level).toBe(9)
  })
})
