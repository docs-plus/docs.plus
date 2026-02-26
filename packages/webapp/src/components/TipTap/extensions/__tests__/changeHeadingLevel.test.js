import changeHeadingLevel from '../changeHeadingLevel'
import changeHeadingLevelBackward from '../changeHeadingLevel-backward'
import changeHeadingLevelForward from '../changeHeadingLevel-forward'
import changeHeadingLevelForwardH1 from '../changeHeadingLevel-h1'

jest.mock('../changeHeadingLevel-backward', () => jest.fn(() => true))
jest.mock('../changeHeadingLevel-forward', () => jest.fn(() => true))
jest.mock('../changeHeadingLevel-h1', () => jest.fn(() => true))

const mockedBackward = changeHeadingLevelBackward
const mockedForward = changeHeadingLevelForward
const mockedForwardH1 = changeHeadingLevelForwardH1

const buildArgs = (currentLevel) => ({
  state: {
    selection: {
      $from: {
        blockRange: () => ({ start: 10 }),
        doc: {
          nodeAt: () => ({ attrs: { level: currentLevel } })
        }
      },
      $to: {}
    }
  }
})

describe('changeHeadingLevel router', () => {
  beforeEach(() => {
    mockedBackward.mockClear()
    mockedForward.mockClear()
    mockedForwardH1.mockClear()
  })

  it('returns early when level is unchanged', () => {
    const args = buildArgs(3)
    const result = changeHeadingLevel(args, { level: 3 })

    expect(result).toBe(true)
    expect(mockedBackward).not.toHaveBeenCalled()
    expect(mockedForward).not.toHaveBeenCalled()
    expect(mockedForwardH1).not.toHaveBeenCalled()
  })

  it('routes current H1 changes to H1 handler', () => {
    const args = buildArgs(1)
    const attributes = { level: 4 }

    const result = changeHeadingLevel(args, attributes)

    expect(result).toBe(true)
    expect(mockedForwardH1).toHaveBeenCalledTimes(1)
    expect(mockedForwardH1).toHaveBeenCalledWith(args, attributes)
    expect(mockedForward).not.toHaveBeenCalled()
    expect(mockedBackward).not.toHaveBeenCalled()
  })

  it('routes to forward handler when target level is deeper', () => {
    const args = buildArgs(3)
    const attributes = { level: 6 }

    const result = changeHeadingLevel(args, attributes)

    expect(result).toBe(true)
    expect(mockedForward).toHaveBeenCalledTimes(1)
    expect(mockedForward).toHaveBeenCalledWith(args, attributes)
    expect(mockedBackward).not.toHaveBeenCalled()
    expect(mockedForwardH1).not.toHaveBeenCalled()
  })

  it('routes to backward handler when target level is shallower', () => {
    const args = buildArgs(5)
    const attributes = { level: 2 }

    const result = changeHeadingLevel(args, attributes)

    expect(result).toBe(true)
    expect(mockedBackward).toHaveBeenCalledTimes(1)
    expect(mockedBackward).toHaveBeenCalledWith(args, attributes)
    expect(mockedForward).not.toHaveBeenCalled()
    expect(mockedForwardH1).not.toHaveBeenCalled()
  })

  // V-3: HN-10 §1 — levels must be clamped to L = {1..10}
  it('clamps level 0 to 1 (HN-10 §1 lower bound)', () => {
    const args = buildArgs(5)
    changeHeadingLevel(args, { level: 0 })

    // Level 0 clamped to 1 → current is H5, target is H1 → H1 handler
    expect(mockedForwardH1).not.toHaveBeenCalled()
    // H5 → H1 is backward (1 < 5)
    expect(mockedBackward).toHaveBeenCalledTimes(1)
    expect(mockedBackward).toHaveBeenCalledWith(args, { level: 1 })
  })

  it('clamps level 11 to 10 (HN-10 §1 upper bound)', () => {
    const args = buildArgs(5)
    changeHeadingLevel(args, { level: 11 })

    // Level 11 clamped to 10 → current is H5, target is H10 → forward handler
    expect(mockedForward).toHaveBeenCalledTimes(1)
    expect(mockedForward).toHaveBeenCalledWith(args, { level: 10 })
  })

  it('clamps negative level to 1', () => {
    const args = buildArgs(3)
    changeHeadingLevel(args, { level: -5 })

    // Level -5 clamped to 1 → current is H3, target is H1 → backward (1 < 3)
    // But currentHLevel is 3, not 1, so it won't hit the H1 handler path
    expect(mockedBackward).toHaveBeenCalledTimes(1)
    expect(mockedBackward).toHaveBeenCalledWith(args, { level: 1 })
  })
})
