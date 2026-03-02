import { TIPTAP_NODES } from '@types'

import deleteSelectedRange from '../deleteSelectedRange'
import { getSelectionRangeBlocks, getSelectionRangeSlice, insertRemainingHeadings } from '../helper'

jest.mock('../helper', () => ({
  getSelectionRangeBlocks: jest.fn(),
  getSelectionRangeSlice: jest.fn(),
  insertRemainingHeadings: jest.fn()
}))

jest.mock('@tiptap/pm/state', () => {
  const actual = jest.requireActual('@tiptap/pm/state')
  return {
    ...actual,
    TextSelection: class MockTextSelection {
      $pos: unknown
      constructor($pos: unknown) {
        this.$pos = $pos
      }
    }
  }
})

const createEditorMock = (overrides: Record<string, any> = {}) => {
  const tr = {
    deleteRange: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
    setSelection: jest.fn(),
    mapping: { map: (pos: number) => pos },
    doc: {
      resolve: (pos: number) => ({ pos })
    },
    ...(overrides.tr || {})
  }

  const selection = {
    from: 20,
    to: 30,
    $from: {
      pos: 20,
      start: () => 11,
      end: () => 40,
      blockRange: () => ({
        $from: { parent: { type: { name: TIPTAP_NODES.PARAGRAPH_TYPE } } },
        $to: { nodeBefore: null, nodeAfter: null }
      })
    },
    $to: {
      pos: 30,
      end: () => 40
    },
    $anchor: {
      textOffset: 0,
      nodeAfter: null
    },
    $head: {
      textOffset: 0
    },
    ...(overrides.selection || {})
  }

  const doc = {
    content: { size: 200 },
    resolve: () => ({
      parent: { type: { name: TIPTAP_NODES.PARAGRAPH_TYPE } }
    }),
    descendants: (cb: Function) => {
      cb(
        { type: { name: TIPTAP_NODES.CONTENT_HEADING_TYPE }, isBlock: true, content: { size: 10 } },
        1,
        null,
        0
      )
      cb(
        { type: { name: TIPTAP_NODES.PARAGRAPH_TYPE }, isBlock: true, content: { size: 50 } },
        100,
        null,
        1
      )
    },
    ...(overrides.doc || {})
  }

  const state = {
    selection,
    doc,
    tr,
    schema: {
      nodeFromJSON: (node) => node
    },
    ...(overrides.state || {})
  }

  return {
    state,
    view: {
      dispatch: jest.fn()
    },
    ...(overrides.editor || {})
  }
}

describe('deleteSelectedRange', () => {
  beforeEach(() => {
    jest.mocked(getSelectionRangeBlocks).mockReset()
    jest.mocked(getSelectionRangeSlice).mockReset()
    jest.mocked(insertRemainingHeadings).mockReset()
  })

  it('returns false for full-document selection and defers to default behavior', () => {
    const editor = createEditorMock({
      selection: {
        $from: {
          pos: 0,
          start: () => 1,
          end: () => 40,
          blockRange: () => null
        },
        $to: { pos: 200, end: () => 200 }
      },
      doc: {
        content: { size: 200 },
        descendants: (cb: Function) => {
          cb(
            {
              type: { name: TIPTAP_NODES.CONTENT_HEADING_TYPE },
              isBlock: true,
              content: { size: 10 }
            },
            1,
            null,
            0
          )
          cb(
            { type: { name: TIPTAP_NODES.PARAGRAPH_TYPE }, isBlock: true, content: { size: 150 } },
            40,
            null,
            1
          )
        }
      }
    })

    const result = deleteSelectedRange(editor)

    expect(result).toBe(false)
    expect(editor.view.dispatch).not.toHaveBeenCalled()
    expect(getSelectionRangeBlocks).not.toHaveBeenCalled()
    expect(getSelectionRangeSlice).not.toHaveBeenCalled()
  })

  it('returns false when selection ends inside contentHeading (safe fallback)', () => {
    const editor = createEditorMock({
      doc: {
        resolve: () => ({
          parent: { type: { name: TIPTAP_NODES.CONTENT_HEADING_TYPE } }
        }),
        descendants: (cb: Function) => {
          cb(
            {
              type: { name: TIPTAP_NODES.CONTENT_HEADING_TYPE },
              isBlock: true,
              content: { size: 10 }
            },
            1,
            null,
            0
          )
          cb(
            { type: { name: TIPTAP_NODES.PARAGRAPH_TYPE }, isBlock: true, content: { size: 150 } },
            40,
            null,
            1
          )
        }
      }
    })

    const result = deleteSelectedRange(editor)

    expect(result).toBe(false)
    expect(editor.view.dispatch).not.toHaveBeenCalled()
    expect(getSelectionRangeBlocks).not.toHaveBeenCalled()
  })

  it('returns false when only one block is selected', () => {
    const editor = createEditorMock()

    jest
      .mocked(getSelectionRangeSlice)
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        { type: TIPTAP_NODES.PARAGRAPH_TYPE, startBlockPos: 31, endBlockPos: 35 }
      ])
    jest
      .mocked(getSelectionRangeBlocks)
      .mockReturnValue([
        { type: TIPTAP_NODES.PARAGRAPH_TYPE, startBlockPos: 20, endBlockPos: 25, content: [] }
      ])

    const result = deleteSelectedRange(editor)

    expect(result).toBe(false)
    expect(editor.view.dispatch).not.toHaveBeenCalled()
  })

  it('dispatches and returns true when multi-block delete is handled', () => {
    const editor = createEditorMock()

    jest
      .mocked(getSelectionRangeSlice)
      .mockReturnValueOnce([
        { type: TIPTAP_NODES.HEADING_TYPE, startBlockPos: 35, endBlockPos: 50, content: [] }
      ])
      .mockReturnValueOnce([
        {
          type: TIPTAP_NODES.PARAGRAPH_TYPE,
          startBlockPos: 31,
          endBlockPos: 35,
          content: [{ type: TIPTAP_NODES.TEXT_TYPE, text: 'tail' }]
        }
      ])

    jest.mocked(getSelectionRangeBlocks).mockReturnValue([
      {
        type: TIPTAP_NODES.PARAGRAPH_TYPE,
        startBlockPos: 20,
        endBlockPos: 25,
        content: [{ type: TIPTAP_NODES.TEXT_TYPE, text: 'a' }]
      },
      {
        type: TIPTAP_NODES.PARAGRAPH_TYPE,
        startBlockPos: 25,
        endBlockPos: 30,
        content: [{ type: TIPTAP_NODES.TEXT_TYPE, text: 'b' }]
      }
    ])
    jest.mocked(insertRemainingHeadings).mockReturnValue(true)

    const result = deleteSelectedRange(editor)

    expect(result).toBe(true)
    expect(insertRemainingHeadings).toHaveBeenCalledTimes(1)
    expect(editor.state.tr.setSelection).toHaveBeenCalledTimes(1)
    expect(editor.view.dispatch).toHaveBeenCalledTimes(1)
  })
})
