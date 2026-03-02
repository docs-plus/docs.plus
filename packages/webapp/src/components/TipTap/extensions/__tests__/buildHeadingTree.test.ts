/**
 * Unit tests for buildHeadingTree — HN-10 §5 STACK-ATTACH algorithm.
 *
 * buildHeadingTree takes a FLAT array of heading JSON nodes (each with
 * contentHeading + contentWrapper) and nests child headings inside their
 * parent's contentWrapper based on heading levels.
 *
 * Rules:
 *   - A heading with level > stack-top becomes a child (pushed into parent's contentWrapper)
 *   - A heading with level <= stack-top pops the stack until a valid parent is found
 *   - H1s with no parent on the stack become roots
 */

import { TIPTAP_NODES } from '@types'

import { buildHeadingTree } from '../helper/clipboard'
import { JSONNode } from '../types'

const makeHeadingJson = (level: number, title: string, bodyText?: string): JSONNode => {
  const contentWrapper: JSONNode = {
    type: TIPTAP_NODES.CONTENT_WRAPPER_TYPE,
    content: bodyText
      ? [{ type: TIPTAP_NODES.PARAGRAPH_TYPE, content: [{ type: 'text', text: bodyText }] }]
      : []
  }

  return {
    type: TIPTAP_NODES.HEADING_TYPE,
    attrs: { level },
    content: [
      {
        type: TIPTAP_NODES.CONTENT_HEADING_TYPE,
        attrs: { level },
        content: [{ type: 'text', text: title }]
      },
      contentWrapper
    ]
  }
}

const getContentWrapperHeadings = (heading: JSONNode): JSONNode[] => {
  const wrapper = heading.content?.[1]
  if (!wrapper?.content) return []
  return wrapper.content.filter((n) => n.type === TIPTAP_NODES.HEADING_TYPE)
}

const getTitle = (heading: JSONNode): string => {
  return heading.content?.[0]?.content?.[0]?.text || ''
}

const getLevel = (heading: JSONNode): number => {
  return (heading.content?.[0]?.attrs?.level as number) ?? (heading.attrs?.level as number) ?? 1
}

describe('buildHeadingTree — STACK-ATTACH algorithm', () => {
  it('returns empty array for empty input', () => {
    expect(buildHeadingTree([])).toEqual([])
  })

  it('single H1 returns single root', () => {
    const input = [makeHeadingJson(1, 'Root')]
    const result = buildHeadingTree(input)

    expect(result).toHaveLength(1)
    expect(getTitle(result[0])).toBe('Root')
    expect(getLevel(result[0])).toBe(1)
  })

  it('H1 + multiple H3s → all H3s nested under H1 (minimax pattern)', () => {
    const input = [
      makeHeadingJson(1, 'MiniMax M2.5', 'intro text'),
      makeHeadingJson(3, 'Coding', 'coding body'),
      makeHeadingJson(3, 'Search', 'search body'),
      makeHeadingJson(3, 'Office work', 'office body'),
      makeHeadingJson(3, 'Efficiency'),
      makeHeadingJson(3, 'Cost')
    ]
    const result = buildHeadingTree(input)

    expect(result).toHaveLength(1)
    expect(getTitle(result[0])).toBe('MiniMax M2.5')

    const children = getContentWrapperHeadings(result[0])
    expect(children).toHaveLength(5)
    expect(getTitle(children[0])).toBe('Coding')
    expect(getTitle(children[1])).toBe('Search')
    expect(getTitle(children[2])).toBe('Office work')
    expect(getTitle(children[3])).toBe('Efficiency')
    expect(getTitle(children[4])).toBe('Cost')

    // Body paragraph of root should still be present
    const rootWrapper = result[0].content?.[1]
    const rootParagraphs = rootWrapper?.content?.filter(
      (n) => n.type === TIPTAP_NODES.PARAGRAPH_TYPE
    )
    expect(rootParagraphs).toHaveLength(1)
    expect(rootParagraphs?.[0]?.content?.[0]?.text).toBe('intro text')
  })

  it('H1 + H2 + H3 → H3 under H2, H2 under H1 (consecutive nesting)', () => {
    const input = [
      makeHeadingJson(1, 'Root'),
      makeHeadingJson(2, 'Chapter', 'chapter body'),
      makeHeadingJson(3, 'Section', 'section body')
    ]
    const result = buildHeadingTree(input)

    expect(result).toHaveLength(1)
    expect(getTitle(result[0])).toBe('Root')

    const h2s = getContentWrapperHeadings(result[0])
    expect(h2s).toHaveLength(1)
    expect(getTitle(h2s[0])).toBe('Chapter')

    const h3s = getContentWrapperHeadings(h2s[0])
    expect(h3s).toHaveLength(1)
    expect(getTitle(h3s[0])).toBe('Section')
  })

  it('mixed levels: H1 + H3 + H2 → H3 under H1, then H2 pops H3 and also under H1', () => {
    const input = [
      makeHeadingJson(1, 'Root'),
      makeHeadingJson(3, 'Deep First'),
      makeHeadingJson(2, 'Shallow After')
    ]
    const result = buildHeadingTree(input)

    expect(result).toHaveLength(1)
    const children = getContentWrapperHeadings(result[0])
    expect(children).toHaveLength(2)
    expect(getTitle(children[0])).toBe('Deep First')
    expect(getLevel(children[0])).toBe(3)
    expect(getTitle(children[1])).toBe('Shallow After')
    expect(getLevel(children[1])).toBe(2)
  })

  it('multiple H1s become separate roots (multi-section document)', () => {
    const input = [
      makeHeadingJson(1, 'Section A', 'body a'),
      makeHeadingJson(2, 'Sub A', 'sub body'),
      makeHeadingJson(1, 'Section B', 'body b'),
      makeHeadingJson(2, 'Sub B', 'sub b body')
    ]
    const result = buildHeadingTree(input)

    expect(result).toHaveLength(2)
    expect(getTitle(result[0])).toBe('Section A')
    expect(getTitle(result[1])).toBe('Section B')

    expect(getContentWrapperHeadings(result[0])).toHaveLength(1)
    expect(getTitle(getContentWrapperHeadings(result[0])[0])).toBe('Sub A')

    expect(getContentWrapperHeadings(result[1])).toHaveLength(1)
    expect(getTitle(getContentWrapperHeadings(result[1])[0])).toBe('Sub B')
  })

  it('H2 + H3 + H4 without H1 → H2 is root, H3 under H2, H4 under H3', () => {
    const input = [
      makeHeadingJson(2, 'Chapter'),
      makeHeadingJson(3, 'Section'),
      makeHeadingJson(4, 'Subsection')
    ]
    const result = buildHeadingTree(input)

    expect(result).toHaveLength(1)
    expect(getLevel(result[0])).toBe(2)

    const h3s = getContentWrapperHeadings(result[0])
    expect(h3s).toHaveLength(1)

    const h4s = getContentWrapperHeadings(h3s[0])
    expect(h4s).toHaveLength(1)
    expect(getTitle(h4s[0])).toBe('Subsection')
  })

  it('same-level siblings are all under same parent', () => {
    const input = [
      makeHeadingJson(1, 'Root'),
      makeHeadingJson(2, 'A'),
      makeHeadingJson(2, 'B'),
      makeHeadingJson(2, 'C')
    ]
    const result = buildHeadingTree(input)

    expect(result).toHaveLength(1)
    const children = getContentWrapperHeadings(result[0])
    expect(children).toHaveLength(3)
    expect(getTitle(children[0])).toBe('A')
    expect(getTitle(children[1])).toBe('B')
    expect(getTitle(children[2])).toBe('C')
  })

  it('preserves existing contentWrapper paragraphs when nesting children', () => {
    const input = [
      makeHeadingJson(1, 'Root', 'root body'),
      makeHeadingJson(2, 'Child', 'child body')
    ]
    const result = buildHeadingTree(input)

    const rootWrapper = result[0].content?.[1]
    const paragraphs = rootWrapper?.content?.filter((n) => n.type === TIPTAP_NODES.PARAGRAPH_TYPE)
    const headings = rootWrapper?.content?.filter((n) => n.type === TIPTAP_NODES.HEADING_TYPE)
    expect(paragraphs).toHaveLength(1)
    expect(headings).toHaveLength(1)
  })

  it('full 10-level chain: H1→H2→...→H10 nests each under its predecessor (level boundary)', () => {
    const input = Array.from({ length: 10 }, (_, i) => makeHeadingJson(i + 1, `Level ${i + 1}`))
    const result = buildHeadingTree(input)

    expect(result).toHaveLength(1)
    expect(getLevel(result[0])).toBe(1)
    expect(getTitle(result[0])).toBe('Level 1')

    let current = result[0]
    for (let level = 2; level <= 10; level++) {
      const children = getContentWrapperHeadings(current)
      expect(children).toHaveLength(1)
      expect(getLevel(children[0])).toBe(level)
      expect(getTitle(children[0])).toBe(`Level ${level}`)
      current = children[0]
    }

    // Level 10 has no children
    expect(getContentWrapperHeadings(current)).toHaveLength(0)
  })

  it('complex tree: H1 > H2 > H3, H2 > H3, H1 > H2', () => {
    const input = [
      makeHeadingJson(1, 'A'),
      makeHeadingJson(2, 'A.1'),
      makeHeadingJson(3, 'A.1.1'),
      makeHeadingJson(2, 'A.2'),
      makeHeadingJson(3, 'A.2.1'),
      makeHeadingJson(1, 'B'),
      makeHeadingJson(2, 'B.1')
    ]
    const result = buildHeadingTree(input)

    expect(result).toHaveLength(2)
    expect(getTitle(result[0])).toBe('A')
    expect(getTitle(result[1])).toBe('B')

    const aChildren = getContentWrapperHeadings(result[0])
    expect(aChildren).toHaveLength(2)
    expect(getTitle(aChildren[0])).toBe('A.1')
    expect(getTitle(aChildren[1])).toBe('A.2')

    expect(getContentWrapperHeadings(aChildren[0])).toHaveLength(1)
    expect(getTitle(getContentWrapperHeadings(aChildren[0])[0])).toBe('A.1.1')

    expect(getContentWrapperHeadings(aChildren[1])).toHaveLength(1)
    expect(getTitle(getContentWrapperHeadings(aChildren[1])[0])).toBe('A.2.1')

    const bChildren = getContentWrapperHeadings(result[1])
    expect(bChildren).toHaveLength(1)
    expect(getTitle(bChildren[0])).toBe('B.1')
  })
})

// ===========================================================================
// TG-4: Malformed input resilience
// ===========================================================================

describe('buildHeadingTree — malformed input resilience', () => {
  it('handles heading with missing content array', () => {
    const input: JSONNode[] = [{ type: TIPTAP_NODES.HEADING_TYPE, attrs: { level: 1 } }]
    expect(() => buildHeadingTree(input)).not.toThrow()
    const result = buildHeadingTree(input)
    expect(result).toHaveLength(1)
  })

  it('handles heading with null content entries', () => {
    const input: JSONNode[] = [
      {
        type: TIPTAP_NODES.HEADING_TYPE,
        attrs: { level: 1 },
        content: [
          { type: TIPTAP_NODES.CONTENT_HEADING_TYPE, attrs: { level: 1 } },
          { type: TIPTAP_NODES.CONTENT_WRAPPER_TYPE }
        ]
      }
    ]
    expect(() => buildHeadingTree(input)).not.toThrow()
    expect(buildHeadingTree(input)).toHaveLength(1)
  })

  it('handles heading with missing attrs', () => {
    const input: JSONNode[] = [
      {
        type: TIPTAP_NODES.HEADING_TYPE,
        content: [
          { type: TIPTAP_NODES.CONTENT_HEADING_TYPE },
          { type: TIPTAP_NODES.CONTENT_WRAPPER_TYPE, content: [] }
        ]
      }
    ]
    expect(() => buildHeadingTree(input)).not.toThrow()
    const result = buildHeadingTree(input)
    expect(result).toHaveLength(1)
  })

  it('handles heading with string level value (coercion)', () => {
    const input: JSONNode[] = [
      {
        type: TIPTAP_NODES.HEADING_TYPE,
        attrs: { level: '3' as unknown as number },
        content: [
          { type: TIPTAP_NODES.CONTENT_HEADING_TYPE, attrs: { level: '3' as unknown as number } },
          { type: TIPTAP_NODES.CONTENT_WRAPPER_TYPE, content: [] }
        ]
      }
    ]
    expect(() => buildHeadingTree(input)).not.toThrow()
  })

  it('handles mix of valid and malformed headings without crashing', () => {
    const input: JSONNode[] = [
      makeHeadingJson(1, 'Valid Root'),
      { type: TIPTAP_NODES.HEADING_TYPE },
      makeHeadingJson(2, 'Valid Child')
    ]
    expect(() => buildHeadingTree(input)).not.toThrow()
    const result = buildHeadingTree(input)
    // Malformed heading defaults to level 1 → becomes a second root
    // Valid H2 nests under the malformed H1 (STACK-ATTACH)
    expect(result).toHaveLength(2)
  })
})
