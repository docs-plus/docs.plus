import { adjustHeadingLevelsForContext } from '../helper'
import { buildDoc, createTestSchema, heading, paragraph } from '../testUtils/testSchema'

describe('adjustHeadingLevelsForContext', () => {
  const schema = createTestSchema()

  const makeHeadingJson = (level: number, title: string) =>
    heading(schema, level, title, [paragraph(schema, `${title} body`)]).toJSON()

  it('adjusts non-H1 headings to fit paste context while preserving relative offsets', () => {
    const headingsJson = [makeHeadingJson(2, 'A'), makeHeadingJson(4, 'B')]

    const { adjustedHeadings, h1Headings } = adjustHeadingLevelsForContext(headingsJson, 3, schema)

    expect(h1Headings).toHaveLength(0)
    expect(adjustedHeadings).toHaveLength(2)
    expect(adjustedHeadings.map((x) => x.attrs.level)).toEqual([4, 6])
    expect(adjustedHeadings.map((x) => x.firstChild?.attrs?.level)).toEqual([4, 6])
  })

  it('extracts H1 WITH its subtree when target context is nested', () => {
    const headingsJson = [makeHeadingJson(1, 'Root H1'), makeHeadingJson(3, 'Child')]

    const { adjustedHeadings, h1Headings } = adjustHeadingLevelsForContext(headingsJson, 2, schema)

    expect(h1Headings).toHaveLength(1)
    expect(h1Headings[0].attrs.level).toBe(1)
    expect(h1Headings[0].firstChild?.textContent).toContain('Root H1')

    // H3 is nested under H1's contentWrapper, not separated
    const cw = h1Headings[0].child(1)
    expect(cw.type.name).toBe('contentWrapper')
    const nestedHeading = cw.lastChild
    expect(nestedHeading?.type.name).toBe('heading')
    expect(nestedHeading?.attrs.level).toBe(3)

    expect(adjustedHeadings).toHaveLength(0)
  })

  it('clamps adjusted levels to max 10 in deep contexts', () => {
    const headingsJson = [makeHeadingJson(8, 'Deep A'), makeHeadingJson(9, 'Deep B')]

    const { adjustedHeadings, h1Headings } = adjustHeadingLevelsForContext(headingsJson, 9, schema)

    expect(h1Headings).toHaveLength(0)
    expect(adjustedHeadings).toHaveLength(2)
    expect(adjustedHeadings.map((x) => x.attrs.level)).toEqual([10, 10])
    expect(adjustedHeadings.map((x) => x.firstChild?.attrs?.level)).toEqual([10, 10])
  })

  it('normalizes headings to root context when target context level is 0', () => {
    const headingsJson = [makeHeadingJson(4, 'Far From Root'), makeHeadingJson(6, 'Farther')]

    const { adjustedHeadings } = adjustHeadingLevelsForContext(headingsJson, 0, schema)

    expect(adjustedHeadings.map((x) => x.attrs.level)).toEqual([1, 3])
    expect(adjustedHeadings.map((x) => x.firstChild?.attrs?.level)).toEqual([1, 3])
  })

  it('returns empty arrays for empty heading input', () => {
    const result = adjustHeadingLevelsForContext([], 3, schema)

    expect(result.adjustedHeadings).toEqual([])
    expect(result.h1Headings).toEqual([])
  })

  it('clamps all levels to 10 when contextLevel is 10 (HN-10 §1 boundary)', () => {
    const headingsJson = [makeHeadingJson(2, 'A'), makeHeadingJson(5, 'B'), makeHeadingJson(8, 'C')]

    const { adjustedHeadings, h1Headings } = adjustHeadingLevelsForContext(headingsJson, 10, schema)

    expect(h1Headings).toHaveLength(0)
    expect(adjustedHeadings).toHaveLength(3)
    // All levels should clamp to 10 since contextLevel+1 = 11, but max is 10
    expect(adjustedHeadings.map((x) => x.attrs.level)).toEqual([10, 10, 10])
    expect(adjustedHeadings.map((x) => x.firstChild?.attrs?.level)).toEqual([10, 10, 10])
  })

  it('extracts ALL H1 headings with subtrees when multiple are present', () => {
    const headingsJson = [
      makeHeadingJson(1, 'First H1'),
      makeHeadingJson(3, 'Child of First'),
      makeHeadingJson(1, 'Second H1'),
      makeHeadingJson(4, 'Child of Second'),
      makeHeadingJson(1, 'Third H1')
    ]

    const { adjustedHeadings, h1Headings } = adjustHeadingLevelsForContext(headingsJson, 2, schema)

    expect(h1Headings).toHaveLength(3)
    expect(h1Headings[0].firstChild?.textContent).toContain('First H1')
    expect(h1Headings[1].firstChild?.textContent).toContain('Second H1')
    expect(h1Headings[2].firstChild?.textContent).toContain('Third H1')

    // Each H1 keeps its children via STACK-ATTACH
    const cw0 = h1Headings[0].child(1)
    expect(cw0.lastChild?.type.name).toBe('heading')
    expect(cw0.lastChild?.attrs.level).toBe(3)

    const cw1 = h1Headings[1].child(1)
    expect(cw1.lastChild?.type.name).toBe('heading')
    expect(cw1.lastChild?.attrs.level).toBe(4)

    // Third H1 has no children
    const cw2 = h1Headings[2].child(1)
    expect(cw2.childCount).toBeLessThanOrEqual(1) // only body paragraph

    // No headings go to adjustedHeadings — all are under H1 trees
    expect(adjustedHeadings).toHaveLength(0)
  })

  it('produces valid nodes that can be placed at root', () => {
    const headingsJson = [makeHeadingJson(5, 'Portable')]
    const { adjustedHeadings } = adjustHeadingLevelsForContext(headingsJson, 0, schema)

    const doc = buildDoc(schema, adjustedHeadings)
    expect(doc.childCount).toBe(1)
    expect(doc.firstChild?.type.name).toBe('heading')
    expect(doc.firstChild?.firstChild?.attrs?.level).toBe(1)
  })

  it('minimax scenario: H1 title followed by H3 sections keeps tree intact', () => {
    const headingsJson = [
      makeHeadingJson(1, 'MiniMax M2.5'),
      makeHeadingJson(3, 'Coding'),
      makeHeadingJson(3, 'Search and Tool calling'),
      makeHeadingJson(3, 'Office work')
    ]

    const { adjustedHeadings, h1Headings } = adjustHeadingLevelsForContext(headingsJson, 1, schema)

    // H1 is extracted as a complete tree with all H3 children
    expect(h1Headings).toHaveLength(1)
    expect(h1Headings[0].attrs.level).toBe(1)
    expect(h1Headings[0].firstChild?.textContent).toContain('MiniMax M2.5')

    const cw = h1Headings[0].child(1)
    // contentWrapper should have: body paragraph + 3 heading children
    const headingChildren: number[] = []
    cw.forEach((child) => {
      if (child.type.name === 'heading') headingChildren.push(child.attrs.level)
    })
    expect(headingChildren).toEqual([3, 3, 3])

    // Nothing goes to adjustedHeadings — all headings belong to the H1 tree
    expect(adjustedHeadings).toHaveLength(0)
  })

  it('headings before first H1 are adjusted for context; headings after H1 stay with it', () => {
    const headingsJson = [
      makeHeadingJson(3, 'Before H1'),
      makeHeadingJson(5, 'Also Before'),
      makeHeadingJson(1, 'The H1'),
      makeHeadingJson(3, 'Under H1')
    ]

    const { adjustedHeadings, h1Headings } = adjustHeadingLevelsForContext(headingsJson, 2, schema)

    // Headings before the first H1 are adjusted for context level 2
    expect(adjustedHeadings).toHaveLength(2)
    expect(adjustedHeadings[0].attrs.level).toBe(3) // minLevel=3, required=3, offset=0
    expect(adjustedHeadings[1].attrs.level).toBe(5)

    // H1 and its subtree are extracted together
    expect(h1Headings).toHaveLength(1)
    expect(h1Headings[0].firstChild?.textContent).toContain('The H1')

    const cw = h1Headings[0].child(1)
    expect(cw.lastChild?.type.name).toBe('heading')
    expect(cw.lastChild?.attrs.level).toBe(3)
  })
})
