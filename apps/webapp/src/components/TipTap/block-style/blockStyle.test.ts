import { blockStyleOf, headingStepHonesty } from './blockStyle'

describe('blockStyleOf', () => {
  it('treats the first line as Title even when the node is a heading', () => {
    expect(blockStyleOf(true, 'heading', { level: 1 })).toEqual({ kind: 'title' })
  })

  it('reads Normal from a paragraph, not a leftover heading attr', () => {
    expect(blockStyleOf(false, 'paragraph', { level: 3 })).toEqual({ kind: 'normal' })
  })

  it('reads Subtitle from the paragraph, not heading attrs', () => {
    expect(blockStyleOf(false, 'paragraph', { paragraphStyle: 'subtitle', level: 3 })).toEqual({
      kind: 'subtitle'
    })
  })

  it('reads a body heading', () => {
    expect(blockStyleOf(false, 'heading', { level: 2 })).toEqual({ kind: 'heading', level: 2 })
  })
})

describe('headingStepHonesty', () => {
  it('mutes both ends on Title, Subtitle, and Normal', () => {
    expect(headingStepHonesty({ kind: 'title' })).toEqual({
      canStepDown: false,
      canStepUp: false
    })
    expect(headingStepHonesty({ kind: 'subtitle' })).toEqual({
      canStepDown: false,
      canStepUp: false
    })
    expect(headingStepHonesty({ kind: 'normal' })).toEqual({
      canStepDown: false,
      canStepUp: false
    })
  })

  it('mutes minus on H1 and plus on H6', () => {
    expect(headingStepHonesty({ kind: 'heading', level: 1 })).toEqual({
      canStepDown: false,
      canStepUp: true
    })
    expect(headingStepHonesty({ kind: 'heading', level: 6 })).toEqual({
      canStepDown: true,
      canStepUp: false
    })
  })
})
