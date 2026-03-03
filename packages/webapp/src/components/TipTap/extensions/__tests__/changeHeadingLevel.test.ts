import changeHeadingLevel from '../changeHeadingLevel'
import changeHeadingLevelForwardH1 from '../changeHeadingLevel-h1'

jest.mock('../changeHeadingLevel-h1', () => jest.fn(() => true))

const mockedForwardH1 = jest.mocked(changeHeadingLevelForwardH1)

/**
 * Builds a minimal CommandArgs mock.
 * For non-H1 cases, the in-place setNodeMarkup path needs:
 *   - $from.depth, $from.node(d), $from.before(d)
 *   - tr.doc.nodeAt(pos), tr.setNodeMarkup(), tr.mapping.map()
 */
const buildArgs = (currentLevel: number) => {
  const headingNode = {
    type: { name: 'heading' },
    attrs: { level: currentLevel },
    firstChild: { type: { name: 'contentHeading' }, attrs: { level: currentLevel } }
  }

  const noOpResolved = {
    depth: 1,
    node: () => ({ type: { name: 'doc' } }),
    index: () => 0,
    start: () => 0
  }

  const mockTr = {
    doc: {
      nodeAt: jest.fn(() => headingNode),
      resolve: jest.fn(() => noOpResolved),
      slice: jest.fn(() => ({ content: [] }))
    },
    setNodeMarkup: jest.fn(),
    delete: jest.fn(),
    insert: jest.fn(),
    mapping: { map: jest.fn((pos: number) => pos) }
  }

  return {
    args: {
      state: {
        selection: {
          $from: {
            blockRange: () => ({ start: 10 }),
            doc: { nodeAt: () => ({ attrs: { level: currentLevel } }) },
            depth: 3,
            node: (d: number) => (d === 2 ? headingNode : { type: { name: 'doc' } }),
            before: () => 5
          },
          $to: {}
        }
      },
      tr: mockTr
    },
    mockTr
  }
}

describe('changeHeadingLevel router', () => {
  beforeEach(() => {
    mockedForwardH1.mockClear()
  })

  it('returns early when level is unchanged', () => {
    const { args } = buildArgs(3)
    const result = changeHeadingLevel(args, { level: 3 })

    expect(result).toBe(true)
    expect(mockedForwardH1).not.toHaveBeenCalled()
  })

  it('routes current H1 changes to H1 handler', () => {
    const { args } = buildArgs(1)
    const attributes = { level: 4 }

    const result = changeHeadingLevel(args, attributes)

    expect(result).toBe(true)
    expect(mockedForwardH1).toHaveBeenCalledTimes(1)
    expect(mockedForwardH1).toHaveBeenCalledWith(args, attributes)
  })

  it('does in-place setNodeMarkup for forward (H3→H6)', () => {
    const { args, mockTr } = buildArgs(3)
    const result = changeHeadingLevel(args, { level: 6 })

    expect(result).toBe(true)
    expect(mockedForwardH1).not.toHaveBeenCalled()
    expect(mockTr.setNodeMarkup).toHaveBeenCalledTimes(2)
    expect(mockTr.setNodeMarkup).toHaveBeenCalledWith(5, null, { level: 6 })
  })

  it('does in-place setNodeMarkup for backward (H5→H2)', () => {
    const { args, mockTr } = buildArgs(5)
    const result = changeHeadingLevel(args, { level: 2 })

    expect(result).toBe(true)
    expect(mockedForwardH1).not.toHaveBeenCalled()
    expect(mockTr.setNodeMarkup).toHaveBeenCalledTimes(2)
    expect(mockTr.setNodeMarkup).toHaveBeenCalledWith(5, null, { level: 2 })
  })

  it('clamps level 0 to 1 and does in-place change (H5→H1)', () => {
    const { args, mockTr } = buildArgs(5)
    const result = changeHeadingLevel(args, { level: 0 })

    expect(result).toBe(true)
    // Level 0 clamped to 1 → H5→H1, currentHLevel is 5 (not 1), so in-place path
    expect(mockedForwardH1).not.toHaveBeenCalled()
    expect(mockTr.setNodeMarkup).toHaveBeenCalledTimes(2)
    expect(mockTr.setNodeMarkup).toHaveBeenCalledWith(5, null, { level: 1 })
  })

  it('clamps level 11 to 10 and does in-place change (H5→H10)', () => {
    const { args, mockTr } = buildArgs(5)
    const result = changeHeadingLevel(args, { level: 11 })

    expect(result).toBe(true)
    expect(mockedForwardH1).not.toHaveBeenCalled()
    expect(mockTr.setNodeMarkup).toHaveBeenCalledTimes(2)
    expect(mockTr.setNodeMarkup).toHaveBeenCalledWith(5, null, { level: 10 })
  })

  it('clamps negative level to 1 and does in-place change (H3→H1)', () => {
    const { args, mockTr } = buildArgs(3)
    const result = changeHeadingLevel(args, { level: -5 })

    expect(result).toBe(true)
    expect(mockedForwardH1).not.toHaveBeenCalled()
    expect(mockTr.setNodeMarkup).toHaveBeenCalledTimes(2)
    expect(mockTr.setNodeMarkup).toHaveBeenCalledWith(5, null, { level: 1 })
  })
})
