import type { PlaceholderRenderProps } from '@docs.plus/extension-placeholder'

import {
  buildAncestorChain,
  buildBreadcrumbPlaceholder,
  formatHeadingSegment,
  resolveTailSegment,
  truncateSegment
} from './buildBreadcrumbPlaceholder'

describe('truncateSegment', () => {
  it('returns the original string when within the limit', () => {
    expect(truncateSegment('Methods', 24)).toBe('Methods')
  })

  it('returns the original string when exactly at the limit', () => {
    const exactly24 = 'a'.repeat(24)
    expect(truncateSegment(exactly24, 24)).toBe(exactly24)
  })

  it('truncates and appends ellipsis when over the limit', () => {
    const input = 'a'.repeat(25)
    const expected = 'a'.repeat(21) + '...'
    expect(truncateSegment(input, 24)).toBe(expected)
    expect(truncateSegment(input, 24).length).toBe(24)
  })

  it('truncates a realistic long heading', () => {
    expect(truncateSegment('A surprisingly thorough analysis of distributed systems', 24)).toBe(
      'A surprisingly thorou...'
    )
  })

  it('returns empty string for empty input', () => {
    expect(truncateSegment('', 24)).toBe('')
  })
})

describe('formatHeadingSegment', () => {
  it('returns the trimmed heading text when present', () => {
    expect(formatHeadingSegment({ level: 1, text: 'Introduction' })).toBe('Introduction')
  })

  it('falls back to "Heading N" when text is empty', () => {
    expect(formatHeadingSegment({ level: 1, text: '' })).toBe('Heading 1')
    expect(formatHeadingSegment({ level: 4, text: '' })).toBe('Heading 4')
  })

  it('falls back to "Heading N" when text is whitespace-only', () => {
    expect(formatHeadingSegment({ level: 2, text: '   ' })).toBe('Heading 2')
  })

  it('truncates long heading text with ellipsis', () => {
    expect(
      formatHeadingSegment({
        level: 1,
        text: 'A surprisingly thorough analysis of distributed systems'
      })
    ).toBe('A surprisingly thorou...')
  })
})

describe('buildAncestorChain', () => {
  it('returns empty chain when there are no preceding headings', () => {
    expect(buildAncestorChain([], null)).toEqual([])
  })

  it('returns a single H1 when only an H1 precedes a paragraph', () => {
    const h1 = { level: 1, text: 'Intro' }
    expect(buildAncestorChain([h1], null)).toEqual([h1])
  })

  it('returns the full chain for nested H1 > H2 > H3 above a paragraph', () => {
    const headings = [
      { level: 1, text: 'Doc' },
      { level: 2, text: 'Section' },
      { level: 3, text: 'Sub' }
    ]
    expect(buildAncestorChain(headings, null)).toEqual(headings)
  })

  it('handles skipped levels (H1 > H4 > H6 above paragraph)', () => {
    const headings = [
      { level: 1, text: 'Doc' },
      { level: 4, text: 'Q3' },
      { level: 6, text: 'Item' }
    ]
    expect(buildAncestorChain(headings, null)).toEqual(headings)
  })

  it('drops sibling headings when a new equal-or-higher heading appears', () => {
    const headings = [
      { level: 1, text: 'Doc' },
      { level: 2, text: 'Section A' },
      { level: 3, text: 'A.1' },
      { level: 2, text: 'Section B' }
    ]
    expect(buildAncestorChain(headings, null)).toEqual([
      { level: 1, text: 'Doc' },
      { level: 2, text: 'Section B' }
    ])
  })

  it('keeps the most recent sibling at the deepest level', () => {
    const headings = [
      { level: 1, text: 'Doc' },
      { level: 2, text: 'Section A' },
      { level: 3, text: 'A.1' },
      { level: 3, text: 'A.2' }
    ]
    expect(buildAncestorChain(headings, null)).toEqual([
      { level: 1, text: 'Doc' },
      { level: 2, text: 'Section A' },
      { level: 3, text: 'A.2' }
    ])
  })

  it('excludes the current heading itself when current level is provided', () => {
    const headings = [
      { level: 1, text: 'Doc' },
      { level: 2, text: 'Section A' },
      { level: 3, text: 'A.1' }
    ]
    expect(buildAncestorChain(headings, 3)).toEqual([
      { level: 1, text: 'Doc' },
      { level: 2, text: 'Section A' }
    ])
  })

  it('returns just H1 when cursor is in a new H2 right after H1', () => {
    expect(buildAncestorChain([{ level: 1, text: 'Doc' }], 2)).toEqual([{ level: 1, text: 'Doc' }])
  })

  it('returns empty chain when cursor is in an H1 with nothing before it', () => {
    expect(buildAncestorChain([], 1)).toEqual([])
  })
})

describe('resolveTailSegment', () => {
  it('returns "Heading N" for an empty heading', () => {
    expect(resolveTailSegment({ nodeName: 'heading', headingLevel: 3 })).toBe('Heading 3')
    expect(resolveTailSegment({ nodeName: 'heading', headingLevel: 1 })).toBe('Heading 1')
  })

  it('returns "Subtitle" for a subtitle paragraph', () => {
    expect(resolveTailSegment({ nodeName: 'paragraph', isSubtitle: true })).toBe('Subtitle')
  })

  it('returns "Write here" for a regular paragraph', () => {
    expect(resolveTailSegment({ nodeName: 'paragraph' })).toBe('Write here')
  })

  it('returns "Write code" for a code block', () => {
    expect(resolveTailSegment({ nodeName: 'codeBlock' })).toBe('Write code')
  })

  it('returns empty string for an unknown node type', () => {
    expect(resolveTailSegment({ nodeName: 'mysteryBlock' })).toBe('')
  })
})

interface FakeNode {
  type: { name: string }
  attrs: Record<string, unknown>
  textContent: string
  nodeSize: number
}

interface FakeDoc {
  childCount: number
  child(index: number): FakeNode
  resolve(pos: number): { index(depth: number): number }
}

function heading(level: number, text: string): FakeNode {
  return {
    type: { name: 'heading' },
    attrs: { level },
    textContent: text,
    nodeSize: text.length + 2
  }
}

function paragraph(text = '', extra: Record<string, unknown> = {}): FakeNode {
  return {
    type: { name: 'paragraph' },
    attrs: extra,
    textContent: text,
    nodeSize: text.length + 2
  }
}

function makeDoc(children: FakeNode[]): { doc: FakeDoc; positions: number[] } {
  const positions: number[] = []
  let acc = 0
  for (const child of children) {
    positions.push(acc)
    acc += child.nodeSize
  }
  const doc: FakeDoc = {
    childCount: children.length,
    child: (i) => children[i],
    resolve: (pos) => ({
      index: (_depth: number) => {
        for (let i = children.length - 1; i >= 0; i--) {
          if (positions[i] <= pos) return i
        }
        return 0
      }
    })
  }
  return { doc, positions }
}

function makeProps(
  doc: FakeDoc,
  node: FakeNode,
  pos: number,
  parentName = 'doc'
): PlaceholderRenderProps {
  return {
    editor: { state: { doc } } as unknown as PlaceholderRenderProps['editor'],
    node: node as unknown as PlaceholderRenderProps['node'],
    doc: doc as unknown as PlaceholderRenderProps['doc'],
    pos,
    hasAnchor: true,
    parentName
  }
}

describe('buildBreadcrumbPlaceholder', () => {
  it('returns "Enter document name" for the first H1 at pos 0', () => {
    const titleH1 = heading(1, '')
    const { doc, positions } = makeDoc([titleH1])
    const props = makeProps(doc, titleH1, positions[0])

    expect(buildBreadcrumbPlaceholder(props)).toBe('Enter document name')
  })

  it('renders breadcrumb for a top-level empty paragraph under H1 > H2 > H3', () => {
    const children = [
      heading(1, 'Introduction'),
      heading(2, 'Background'),
      heading(3, 'Methods'),
      paragraph()
    ]
    const { doc, positions } = makeDoc(children)
    const props = makeProps(doc, children[3], positions[3])

    expect(buildBreadcrumbPlaceholder(props)).toBe(
      'Introduction > Background > Methods > Write here'
    )
  })

  it('renders breadcrumb for a top-level empty H3 (parents only + Heading 3 tail)', () => {
    const children = [heading(1, 'Doc'), heading(2, 'Section A'), heading(3, 'A.1'), heading(3, '')]
    const { doc, positions } = makeDoc(children)
    const props = makeProps(doc, children[3], positions[3])

    expect(buildBreadcrumbPlaceholder(props)).toBe('Doc > Section A > Heading 3')
  })

  it('renders "<H1> > Subtitle" for an empty subtitle paragraph after H1', () => {
    const children = [heading(1, 'Project plan'), paragraph('', { paragraphStyle: 'subtitle' })]
    const { doc, positions } = makeDoc(children)
    const props = makeProps(doc, children[1], positions[1])

    expect(buildBreadcrumbPlaceholder(props)).toBe('Project plan > Subtitle')
  })

  it('handles skipped heading levels (H1 > H4 > H6 > paragraph)', () => {
    const children = [
      heading(1, 'Project plan'),
      heading(4, 'Q3 details'),
      heading(6, 'Sub item'),
      paragraph()
    ]
    const { doc, positions } = makeDoc(children)
    const props = makeProps(doc, children[3], positions[3])

    expect(buildBreadcrumbPlaceholder(props)).toBe(
      'Project plan > Q3 details > Sub item > Write here'
    )
  })

  it('falls back to "Heading 1" when the title H1 is empty above a paragraph', () => {
    const children = [heading(1, ''), heading(2, 'Methods'), paragraph()]
    const { doc, positions } = makeDoc(children)
    const props = makeProps(doc, children[2], positions[2])

    expect(buildBreadcrumbPlaceholder(props)).toBe('Heading 1 > Methods > Write here')
  })

  it('truncates long heading segments to 24 chars including ellipsis', () => {
    const children = [
      heading(1, 'A surprisingly thorough analysis of distributed systems'),
      heading(2, 'Methods'),
      paragraph()
    ]
    const { doc, positions } = makeDoc(children)
    const props = makeProps(doc, children[2], positions[2])

    expect(buildBreadcrumbPlaceholder(props)).toBe(
      'A surprisingly thorou... > Methods > Write here'
    )
  })

  it("default scope ('top-level') returns existing 'List' inside list items", () => {
    const children = [heading(1, 'Doc'), paragraph()]
    const { doc, positions } = makeDoc(children)
    const props = makeProps(doc, children[1], positions[1], 'listItem')

    expect(buildBreadcrumbPlaceholder(props)).toBe('List')
  })

  it("default scope ('top-level') returns existing 'To-do' inside task items", () => {
    const children = [heading(1, 'Doc'), paragraph()]
    const { doc, positions } = makeDoc(children)
    const props = makeProps(doc, children[1], positions[1], 'taskItem')

    expect(buildBreadcrumbPlaceholder(props)).toBe('To-do')
  })

  it("default scope ('top-level') returns existing 'Quote' inside blockquote", () => {
    const children = [heading(1, 'Doc'), paragraph()]
    const { doc, positions } = makeDoc(children)
    const props = makeProps(doc, children[1], positions[1], 'blockquote')

    expect(buildBreadcrumbPlaceholder(props)).toBe('Quote')
  })

  it("scope 'all-blocks' renders breadcrumb inside list items", () => {
    const children = [heading(1, 'Doc'), heading(2, 'Tasks'), paragraph()]
    const { doc, positions } = makeDoc(children)
    const props = makeProps(doc, children[2], positions[2], 'listItem')

    expect(buildBreadcrumbPlaceholder(props, { scope: 'all-blocks' })).toBe(
      'Doc > Tasks > Write here'
    )
  })

  it('returns empty string when an unknown node type appears at top-level with no headings', () => {
    const mystery: FakeNode = {
      type: { name: 'mysteryBlock' },
      attrs: {},
      textContent: '',
      nodeSize: 2
    }
    const { doc, positions } = makeDoc([mystery])
    const props = makeProps(doc, mystery, positions[0])

    expect(buildBreadcrumbPlaceholder(props)).toBe('')
  })

  it("default scope keeps existing 'Write code' for an empty top-level code block", () => {
    const codeBlock: FakeNode = {
      type: { name: 'codeBlock' },
      attrs: {},
      textContent: '',
      nodeSize: 2
    }
    const children = [heading(1, 'Doc'), heading(2, 'Section'), codeBlock]
    const { doc, positions } = makeDoc(children)
    const props = makeProps(doc, codeBlock, positions[2])

    expect(buildBreadcrumbPlaceholder(props)).toBe('Write code')
  })

  it('does not throw when pos is out of range of stale editor.state.doc (newDoc-only)', () => {
    // Simulates the apply() reentrancy on initial setContent: editor.state.doc
    // is the small/empty old doc, but `pos` was computed from the new doc.
    // Builder must use props.doc, not editor.state.doc.
    const newChildren = [heading(1, 'Title'), paragraph(), paragraph(), paragraph()]
    const { doc: newDoc, positions } = makeDoc(newChildren)
    const staleEmpty = makeDoc([paragraph()]).doc
    const props: PlaceholderRenderProps = {
      editor: {
        state: { doc: staleEmpty }
      } as unknown as PlaceholderRenderProps['editor'],
      node: newChildren[3] as unknown as PlaceholderRenderProps['node'],
      doc: newDoc as unknown as PlaceholderRenderProps['doc'],
      pos: positions[3],
      hasAnchor: true,
      parentName: 'doc'
    }
    expect(() => buildBreadcrumbPlaceholder(props)).not.toThrow()
    expect(buildBreadcrumbPlaceholder(props)).toBe('Title > Write here')
  })

  it("default scope keeps existing 'Heading' for an empty heading inside a blockquote", () => {
    const children = [heading(1, 'Doc'), heading(2, ''), paragraph()]
    const { doc, positions } = makeDoc(children)
    const props = makeProps(doc, children[1], positions[1], 'blockquote')

    expect(buildBreadcrumbPlaceholder(props)).toBe('Heading')
  })
})
