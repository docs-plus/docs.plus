/**
 * Unit tests for handleFullDocumentPaste — the full-document paste pipeline.
 *
 * When the user does CMD+A → CMD+V, the selection resolves at depth 0.
 * handleFullDocumentPaste must:
 *   1. Transform the flat clipboard content into structured heading groups
 *   2. Build a nested HN-10 tree via STACK-ATTACH
 *   3. Replace the entire document
 *   4. Dispatch the transaction
 *
 * These tests verify the transformation pipeline produces valid HN-10 documents.
 */

import { Fragment, Slice } from '@tiptap/pm/model'
import { EditorState } from '@tiptap/pm/state'
import { TIPTAP_NODES } from '@types'

import {
  buildDoc,
  contentHeading,
  contentWrapper,
  createTestSchema,
  heading,
  paragraph
} from '../testUtils/testSchema'

const schema = createTestSchema()

/**
 * Build a flat Slice from contentHeading + paragraph nodes — simulates what
 * ProseMirror's HTML parser produces from external HTML like <h1>, <h3>, <p>.
 */
const buildFlatSlice = (nodes: ReturnType<typeof schema.nodes.paragraph.create>[]) => {
  return new Slice(Fragment.from(nodes), 0, 0)
}

/**
 * Create a mock editor with AllSelection (depth 0) for full-doc paste testing.
 */
const createMockEditor = (doc: ReturnType<typeof buildDoc>) => {
  const state = EditorState.create({ doc, schema })
  return {
    state: {
      ...state,
      schema: state.schema,
      tr: state.tr,
      selection: {
        from: 0,
        to: doc.content.size,
        $from: doc.resolve(0),
        $to: doc.resolve(doc.content.size)
      }
    },
    view: {
      dispatch: jest.fn()
    }
  }
}

/**
 * Extract heading snapshot from a doc for assertion.
 */
const getHeadingInfo = (doc: ReturnType<typeof buildDoc>) => {
  const headings: { level: number; title: string; depth: number }[] = []
  doc.descendants((node, pos) => {
    if (node.type.name === TIPTAP_NODES.HEADING_TYPE) {
      const level = node.firstChild?.attrs?.level || 1
      headings.push({
        level,
        title: node.firstChild?.textContent || '',
        depth: doc.resolve(pos).depth
      })
    }
  })
  return headings
}

describe('handleFullDocumentPaste — full-document replacement pipeline', () => {
  let clipboardPaste: typeof import('../clipboardPaste').default

  beforeAll(async () => {
    const mod = await import('../clipboardPaste')
    clipboardPaste = mod.default
  })

  it('replaces entire doc with simple H1 + paragraph', () => {
    const existingDoc = buildDoc(schema, [
      heading(schema, 1, 'Old Section', [paragraph(schema, 'old content')])
    ])
    const mockEditor = createMockEditor(existingDoc)

    const slice = buildFlatSlice([
      contentHeading(schema, 1, 'New Section'),
      paragraph(schema, 'new content')
    ])

    const result = clipboardPaste(slice, mockEditor as any)

    expect(result).toEqual(Slice.empty)
    expect(mockEditor.view.dispatch).toHaveBeenCalledTimes(1)

    const dispatched = mockEditor.view.dispatch.mock.calls[0][0]
    const newDoc = dispatched.doc

    const headings = getHeadingInfo(newDoc)
    expect(headings).toHaveLength(1)
    expect(headings[0].level).toBe(1)
    expect(headings[0].title).toBe('New Section')
  })

  it('builds nested tree from H1 + H3s (minimax pattern)', () => {
    const existingDoc = buildDoc(schema, [heading(schema, 1, 'Old', [paragraph(schema, 'old')])])
    const mockEditor = createMockEditor(existingDoc)

    const slice = buildFlatSlice([
      contentHeading(schema, 1, 'MiniMax M2.5'),
      paragraph(schema, 'intro text'),
      contentHeading(schema, 3, 'Coding'),
      paragraph(schema, 'coding body'),
      contentHeading(schema, 3, 'Search'),
      paragraph(schema, 'search body'),
      contentHeading(schema, 3, 'Office'),
      paragraph(schema, 'office body')
    ])

    const result = clipboardPaste(slice, mockEditor as any)

    expect(result).toEqual(Slice.empty)
    expect(mockEditor.view.dispatch).toHaveBeenCalledTimes(1)

    const newDoc = mockEditor.view.dispatch.mock.calls[0][0].doc
    const headings = getHeadingInfo(newDoc)

    // Root H1
    expect(headings[0].level).toBe(1)
    expect(headings[0].title).toBe('MiniMax M2.5')
    expect(headings[0].depth).toBe(0)

    // H3 children nested under H1
    const h3s = headings.filter((h) => h.level === 3)
    expect(h3s).toHaveLength(3)
    expect(h3s[0].title).toBe('Coding')
    expect(h3s[1].title).toBe('Search')
    expect(h3s[2].title).toBe('Office')

    // H3s should be at greater depth than H1
    h3s.forEach((h3) => {
      expect(h3.depth).toBeGreaterThan(headings[0].depth)
    })
  })

  it('handles orphan paragraphs before first heading', () => {
    const existingDoc = buildDoc(schema, [heading(schema, 1, 'Old', [paragraph(schema, 'old')])])
    const mockEditor = createMockEditor(existingDoc)

    const slice = buildFlatSlice([
      paragraph(schema, 'orphan date line'),
      contentHeading(schema, 1, 'Main Title'),
      paragraph(schema, 'body text')
    ])

    const result = clipboardPaste(slice, mockEditor as any)
    expect(result).toEqual(Slice.empty)

    const newDoc = mockEditor.view.dispatch.mock.calls[0][0].doc
    const headings = getHeadingInfo(newDoc)

    expect(headings).toHaveLength(1)
    expect(headings[0].title).toBe('Main Title')

    // Orphan paragraph should be inside the first heading's contentWrapper
    let orphanFound = false
    newDoc.descendants((node: any) => {
      if (
        node.type.name === TIPTAP_NODES.PARAGRAPH_TYPE &&
        node.textContent === 'orphan date line'
      ) {
        orphanFound = true
      }
    })
    expect(orphanFound).toBe(true)
  })

  it('creates default H1 when paste contains only paragraphs (no headings)', () => {
    const existingDoc = buildDoc(schema, [heading(schema, 1, 'Old', [paragraph(schema, 'old')])])
    const mockEditor = createMockEditor(existingDoc)

    const slice = buildFlatSlice([
      paragraph(schema, 'just plain text'),
      paragraph(schema, 'more plain text')
    ])

    const result = clipboardPaste(slice, mockEditor as any)
    expect(result).toEqual(Slice.empty)

    const newDoc = mockEditor.view.dispatch.mock.calls[0][0].doc
    const headings = getHeadingInfo(newDoc)

    // Schema requires doc.content = 'heading+', so at least one heading must exist
    expect(headings.length).toBeGreaterThanOrEqual(1)

    // Paragraphs should be inside the heading's contentWrapper
    let paragraphTexts: string[] = []
    newDoc.descendants((node: any) => {
      if (node.type.name === TIPTAP_NODES.PARAGRAPH_TYPE && node.textContent) {
        paragraphTexts.push(node.textContent)
      }
    })
    expect(paragraphTexts).toContain('just plain text')
    expect(paragraphTexts).toContain('more plain text')
  })

  it('handles H1 + H2 + H3 consecutive nesting', () => {
    const existingDoc = buildDoc(schema, [heading(schema, 1, 'Old', [paragraph(schema, 'old')])])
    const mockEditor = createMockEditor(existingDoc)

    const slice = buildFlatSlice([
      contentHeading(schema, 1, 'Root'),
      paragraph(schema, 'root body'),
      contentHeading(schema, 2, 'Chapter'),
      paragraph(schema, 'chapter body'),
      contentHeading(schema, 3, 'Section'),
      paragraph(schema, 'section body')
    ])

    const result = clipboardPaste(slice, mockEditor as any)
    expect(result).toEqual(Slice.empty)

    const newDoc = mockEditor.view.dispatch.mock.calls[0][0].doc
    const headings = getHeadingInfo(newDoc)

    expect(headings).toHaveLength(3)
    expect(headings[0]).toMatchObject({ level: 1, title: 'Root' })
    expect(headings[1]).toMatchObject({ level: 2, title: 'Chapter' })
    expect(headings[2]).toMatchObject({ level: 3, title: 'Section' })

    // Each child should be at greater depth than its parent
    expect(headings[1].depth).toBeGreaterThan(headings[0].depth)
    expect(headings[2].depth).toBeGreaterThan(headings[1].depth)
  })

  it('handles multiple H1 sections (multi-root document)', () => {
    const existingDoc = buildDoc(schema, [heading(schema, 1, 'Old', [paragraph(schema, 'old')])])
    const mockEditor = createMockEditor(existingDoc)

    const slice = buildFlatSlice([
      contentHeading(schema, 1, 'Section One'),
      paragraph(schema, 'body one'),
      contentHeading(schema, 2, 'Sub One'),
      paragraph(schema, 'sub body'),
      contentHeading(schema, 1, 'Section Two'),
      paragraph(schema, 'body two')
    ])

    const result = clipboardPaste(slice, mockEditor as any)
    expect(result).toEqual(Slice.empty)

    const newDoc = mockEditor.view.dispatch.mock.calls[0][0].doc
    const headings = getHeadingInfo(newDoc)

    const rootHeadings = headings.filter((h) => h.depth === 0)
    expect(rootHeadings).toHaveLength(2)
    expect(rootHeadings[0].title).toBe('Section One')
    expect(rootHeadings[1].title).toBe('Section Two')
  })
})
