import { findPrevBlock } from '../helper'

describe('findPrevBlock Function', () => {
  const itMap = [
    { le: 1, depth: 0, startBlockPos: 150, endBlockPos: 653 },
    { le: 3, depth: 2, startBlockPos: 194, endBlockPos: 411 },
    { le: 4, depth: 4, startBlockPos: 229, endBlockPos: 409 },
    { le: 5, depth: 6, startBlockPos: 298, endBlockPos: 407 },
    { le: 2, depth: 2, startBlockPos: 411, endBlockPos: 651 },
    { le: 8, depth: 4, startBlockPos: 470, endBlockPos: 510 },
    { le: 3, depth: 4, startBlockPos: 510, endBlockPos: 649 },
    { le: 9, depth: 6, startBlockPos: 566, endBlockPos: 647 }
  ]

  it('STACK-ATTACH: level 3 finds nearest ancestor with le < 3 → H2, nested', () => {
    const result = findPrevBlock(itMap, 3)
    // findLast(x => x.le < 3) → {le: 2} (H2 at pos 411)
    expect(result.prevBlock).toEqual({ le: 2, depth: 2, startBlockPos: 411, endBlockPos: 651 })
    expect(result.shouldNested).toBe(true)
  })

  it('STACK-ATTACH: level 7 finds nearest ancestor with le < 7 → H3, nested', () => {
    const result = findPrevBlock(itMap, 7)
    expect(result.prevBlock).toEqual({ le: 3, depth: 4, startBlockPos: 510, endBlockPos: 649 })
    expect(result.shouldNested).toBe(true)
  })

  it('STACK-ATTACH: level 9 finds nearest ancestor with le < 9 → H3, nested', () => {
    const result = findPrevBlock(itMap, 9)
    // findLast(x => x.le < 9) → {le: 3} (H3 at pos 510)
    expect(result.prevBlock).toEqual({ le: 3, depth: 4, startBlockPos: 510, endBlockPos: 649 })
    expect(result.shouldNested).toBe(true)
  })

  it('STACK-ATTACH: level 6 finds nearest ancestor with le < 6 → H3, nested', () => {
    const result = findPrevBlock(itMap, 6)
    expect(result.prevBlock).toEqual({ le: 3, depth: 4, startBlockPos: 510, endBlockPos: 649 })
    expect(result.shouldNested).toBe(true)
  })

  it('STACK-ATTACH: level 1 has no ancestor (no le < 1) → fallback same-level H1, not nested', () => {
    const result = findPrevBlock(itMap, 1)
    // findLast(x => x.le < 1) → null → same-level sibling: findLast(x => x.le === 1) → H1
    expect(result.prevBlock).toEqual({ le: 1, depth: 0, startBlockPos: 150, endBlockPos: 653 })
    expect(result.shouldNested).toBe(false)
  })

  it('should return null for prevBlock and set shouldNested to false when mapHPost array is empty', () => {
    const result = findPrevBlock([], 3)
    expect(result.prevBlock).toEqual(null)
    expect(result.shouldNested).toBe(false)
  })

  it('STACK-ATTACH: level 5 finds nearest ancestor with le < 5 → H3, nested', () => {
    const result = findPrevBlock(itMap, 5)
    expect(result.prevBlock).toEqual({ le: 3, depth: 4, startBlockPos: 510, endBlockPos: 649 })
    expect(result.shouldNested).toBe(true)
  })

  it('STACK-ATTACH: level 2 finds nearest ancestor with le < 2 → H1, nested', () => {
    const result = findPrevBlock(itMap, 2)
    // findLast(x => x.le < 2) → {le: 1} (H1 at pos 150)
    expect(result.prevBlock).toEqual({ le: 1, depth: 0, startBlockPos: 150, endBlockPos: 653 })
    expect(result.shouldNested).toBe(true)
  })

  it('STACK-ATTACH: level 10 finds nearest ancestor with le < 10 → H9, nested', () => {
    const result = findPrevBlock(itMap, 10)
    expect(result.prevBlock).toEqual({ le: 9, depth: 6, startBlockPos: 566, endBlockPos: 647 })
    expect(result.shouldNested).toBe(true)
  })

  it('STACK-ATTACH: level 4 finds nearest ancestor with le < 4 → H3, nested', () => {
    const result = findPrevBlock(itMap, 4)
    expect(result.prevBlock).toEqual({ le: 3, depth: 4, startBlockPos: 510, endBlockPos: 649 })
    expect(result.shouldNested).toBe(true)
  })
})

describe('findPrevBlock Function - 2', () => {
  const itMap = [
    { le: 1, depth: 0, startBlockPos: 150, endBlockPos: 731 },
    { le: 2, depth: 2, startBlockPos: 411, endBlockPos: 729 },
    { le: 8, depth: 4, startBlockPos: 470, endBlockPos: 510 },
    { le: 8, depth: 4, startBlockPos: 510, endBlockPos: 588 },
    { le: 3, depth: 4, startBlockPos: 588, endBlockPos: 727 },
    { le: 9, depth: 6, startBlockPos: 644, endBlockPos: 725 }
  ]

  it('STACK-ATTACH: level 2 finds nearest ancestor with le < 2 → H1, nested', () => {
    const result = findPrevBlock(itMap, 2)
    // findLast(x => x.le < 2) → {le: 1} (H1 at pos 150)
    expect(result.prevBlock).toEqual({ le: 1, depth: 0, startBlockPos: 150, endBlockPos: 731 })
    expect(result.shouldNested).toBe(true)
  })

  it('STACK-ATTACH: level 4 finds nearest ancestor with le < 4 → H3, nested', () => {
    const result = findPrevBlock(itMap, 4)
    expect(result.prevBlock).toEqual({ le: 3, depth: 4, startBlockPos: 588, endBlockPos: 727 })
    expect(result.shouldNested).toBe(true)
  })

  it('STACK-ATTACH: level 7 finds nearest ancestor with le < 7 → H3, nested', () => {
    const result = findPrevBlock(itMap, 7)
    expect(result.prevBlock).toEqual({ le: 3, depth: 4, startBlockPos: 588, endBlockPos: 727 })
    expect(result.shouldNested).toBe(true)
  })

  it('STACK-ATTACH: level 1 has no ancestor (no le < 1) → fallback same-level H1, not nested', () => {
    const result = findPrevBlock(itMap, 1)
    // findLast(x => x.le < 1) → null → same-level sibling: findLast(x => x.le === 1) → H1
    expect(result.prevBlock).toEqual({ le: 1, depth: 0, startBlockPos: 150, endBlockPos: 731 })
    expect(result.shouldNested).toBe(false)
  })

  it('STACK-ATTACH: level 10 finds nearest ancestor with le < 10 → H9, nested', () => {
    const result = findPrevBlock(itMap, 10)
    expect(result.prevBlock).toEqual({ le: 9, depth: 6, startBlockPos: 644, endBlockPos: 725 })
    expect(result.shouldNested).toBe(true)
  })

  it('STACK-ATTACH: level 9 finds nearest ancestor with le < 9 → H3, nested', () => {
    const result = findPrevBlock(itMap, 9)
    // findLast(x => x.le < 9) → {le: 3} (H3 at pos 588)
    expect(result.prevBlock).toEqual({ le: 3, depth: 4, startBlockPos: 588, endBlockPos: 727 })
    expect(result.shouldNested).toBe(true)
  })

  it('STACK-ATTACH: level 8 finds nearest ancestor with le < 8 → H3, nested', () => {
    const result = findPrevBlock(itMap, 8)
    expect(result.prevBlock).toEqual({ le: 3, depth: 4, startBlockPos: 588, endBlockPos: 727 })
    expect(result.shouldNested).toBe(true)
  })
})

describe('findPrevBlock Function - Edge Cases', () => {
  it('single H1 block: level 2 should nest inside H1', () => {
    const map = [{ le: 1, depth: 0, startBlockPos: 0, endBlockPos: 100 }]
    const result = findPrevBlock(map, 2)
    expect(result.prevBlock).toEqual(map[0])
    expect(result.shouldNested).toBe(true)
  })

  it('single H1 block: level 1 should be sibling (fallback)', () => {
    const map = [{ le: 1, depth: 0, startBlockPos: 0, endBlockPos: 100 }]
    const result = findPrevBlock(map, 1)
    expect(result.prevBlock).toEqual(map[0])
    expect(result.shouldNested).toBe(false)
  })

  it('non-sequential jump: H1 → H4 nests inside H1', () => {
    const map = [{ le: 1, depth: 0, startBlockPos: 0, endBlockPos: 200 }]
    const result = findPrevBlock(map, 4)
    expect(result.prevBlock).toEqual(map[0])
    expect(result.shouldNested).toBe(true)
  })

  it('non-sequential jump: H1 → H10 nests inside H1', () => {
    const map = [{ le: 1, depth: 0, startBlockPos: 0, endBlockPos: 200 }]
    const result = findPrevBlock(map, 10)
    expect(result.prevBlock).toEqual(map[0])
    expect(result.shouldNested).toBe(true)
  })

  it('deep chain: [1,2,3,4,5] → level 3 nests inside H2', () => {
    const map = [
      { le: 1, depth: 0, startBlockPos: 0, endBlockPos: 500 },
      { le: 2, depth: 2, startBlockPos: 50, endBlockPos: 450 },
      { le: 3, depth: 4, startBlockPos: 100, endBlockPos: 400 },
      { le: 4, depth: 6, startBlockPos: 150, endBlockPos: 350 },
      { le: 5, depth: 8, startBlockPos: 200, endBlockPos: 300 }
    ]
    const result = findPrevBlock(map, 3)
    expect(result.prevBlock).toEqual(map[1]) // H2
    expect(result.shouldNested).toBe(true)
  })

  it('same-level siblings: [1,2,2,2] → level 2 nests inside H1', () => {
    const map = [
      { le: 1, depth: 0, startBlockPos: 0, endBlockPos: 500 },
      { le: 2, depth: 2, startBlockPos: 50, endBlockPos: 200 },
      { le: 2, depth: 2, startBlockPos: 200, endBlockPos: 350 },
      { le: 2, depth: 2, startBlockPos: 350, endBlockPos: 480 }
    ]
    const result = findPrevBlock(map, 2)
    expect(result.prevBlock).toEqual(map[0]) // H1
    expect(result.shouldNested).toBe(true)
  })

  it('all same level: [3,3,3] → level 3 returns fallback (last block, not nested)', () => {
    const map = [
      { le: 3, depth: 0, startBlockPos: 0, endBlockPos: 100 },
      { le: 3, depth: 0, startBlockPos: 100, endBlockPos: 200 },
      { le: 3, depth: 0, startBlockPos: 200, endBlockPos: 300 }
    ]
    const result = findPrevBlock(map, 3)
    expect(result.prevBlock).toEqual(map[2]) // last block
    expect(result.shouldNested).toBe(false)
  })

  it('empty map returns null prevBlock', () => {
    const result = findPrevBlock([], 5)
    expect(result.prevBlock).toBeNull()
    expect(result.shouldNested).toBe(false)
  })
})
