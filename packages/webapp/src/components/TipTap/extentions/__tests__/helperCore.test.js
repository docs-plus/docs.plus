import { getPasteContextLevel, transformClipboardToStructured } from '../helper'
import {
  buildDoc,
  createTestSchema,
  getHeadingSnapshot,
  heading,
  paragraph
} from '../testUtils/testSchema'

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

describe('helper core behavior', () => {
  const schema = createTestSchema()

  describe('transformClipboardToStructured', () => {
    it('splits leading paragraphs from heading streams and groups heading bodies', () => {
      const clipboardContents = [
        paragraph(schema, 'Lead paragraph').toJSON(),
        {
          type: 'contentHeading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Heading A' }]
        },
        paragraph(schema, 'A body paragraph').toJSON(),
        {
          type: 'contentHeading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'Heading B' }]
        }
      ]

      const [paragraphs, headings] = transformClipboardToStructured(clipboardContents, { schema })

      expect(paragraphs).toHaveLength(1)
      expect(paragraphs[0].type.name).toBe('paragraph')
      expect(paragraphs[0].textContent).toContain('Lead paragraph')

      expect(headings).toHaveLength(2)
      expect(headings[0].attrs.level).toBe(2)
      expect(headings[0].firstChild.textContent).toContain('Heading A')
      expect(headings[0].lastChild.childCount).toBe(1)
      expect(headings[0].lastChild.firstChild.textContent).toContain('A body paragraph')

      expect(headings[1].attrs.level).toBe(3)
      expect(headings[1].firstChild.textContent).toContain('Heading B')
      expect(headings[1].lastChild.childCount).toBe(0)
    })

    it('returns empty heading list when clipboard has only non-heading blocks', () => {
      const clipboardContents = [
        paragraph(schema, 'Only para 1').toJSON(),
        paragraph(schema, 'Only para 2').toJSON()
      ]

      const [paragraphs, headings] = transformClipboardToStructured(clipboardContents, { schema })

      expect(paragraphs).toHaveLength(2)
      expect(headings).toHaveLength(0)
    })
  })

  describe('getPasteContextLevel', () => {
    it('returns deepest containing heading level for nested paste positions', () => {
      const doc = buildDoc(schema, [
        heading(schema, 1, 'Root One', [
          paragraph(schema, 'root one body'),
          heading(schema, 2, 'Child Two', [
            paragraph(schema, 'child two body'),
            heading(schema, 3, 'Child Three', [paragraph(schema, 'deep body')])
          ])
        ]),
        heading(schema, 1, 'Root Two', [paragraph(schema, 'root two body')])
      ])

      const rootPos = findTextPos(doc, 'root one body')
      const deepPos = findTextPos(doc, 'deep body')
      const secondRootPos = findTextPos(doc, 'root two body')

      expect(getPasteContextLevel(doc, rootPos)).toBe(1)
      expect(getPasteContextLevel(doc, deepPos)).toBe(3)
      expect(getPasteContextLevel(doc, secondRootPos)).toBe(1)
    })

    it('returns 0 for a position exactly on heading boundaries', () => {
      const doc = buildDoc(schema, [
        heading(schema, 1, 'First Root', [paragraph(schema, 'first')]),
        heading(schema, 1, 'Second Root', [paragraph(schema, 'second')])
      ])

      const headings = getHeadingSnapshot(doc)
      const firstRoot = headings.find((x) => x.title.includes('First Root'))
      expect(firstRoot).toBeDefined()

      const boundaryPos = firstRoot.endPos
      expect(getPasteContextLevel(doc, boundaryPos)).toBe(0)
    })
  })
})
