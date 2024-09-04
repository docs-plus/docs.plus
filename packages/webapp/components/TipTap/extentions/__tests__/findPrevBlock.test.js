import { findPrevBlock } from '../helper'

// INFO: test description written by AI

describe('findPrevBlock Function - 1', () => {
  const testMap = [
    { le: 1, depth: 0, startBlockPos: 150, endBlockPos: 653 },
    { le: 3, depth: 2, startBlockPos: 194, endBlockPos: 411 },
    { le: 4, depth: 4, startBlockPos: 229, endBlockPos: 409 },
    { le: 5, depth: 6, startBlockPos: 298, endBlockPos: 407 },
    { le: 2, depth: 2, startBlockPos: 411, endBlockPos: 651 },
    { le: 8, depth: 4, startBlockPos: 470, endBlockPos: 510 },
    { le: 3, depth: 4, startBlockPos: 510, endBlockPos: 649 },
    { le: 9, depth: 6, startBlockPos: 566, endBlockPos: 647 }
  ]

  test('should return the correct previous block and set shouldNested to false when heading level matches a block', () => {
    const result = findPrevBlock(testMap, 3)
    expect(result.prevBlock).toEqual({ le: 3, depth: 4, startBlockPos: 510, endBlockPos: 649 })
    expect(result.shouldNested).toBe(false)
  })

  test('should return the first block with a greater heading level and set shouldNested to true when no exact match exists', () => {
    const result = findPrevBlock(testMap, 7)
    expect(result.prevBlock).toEqual({ le: 3, depth: 4, startBlockPos: 510, endBlockPos: 649 })
    expect(result.shouldNested).toBe(true)
  })

  test('should return the last block and set shouldNested to false if its level is less than or equal to the heading level', () => {
    const result = findPrevBlock(testMap, 9)
    expect(result.prevBlock).toEqual({ le: 9, depth: 6, startBlockPos: 566, endBlockPos: 647 })
    expect(result.shouldNested).toBe(false)
  })

  test('should return the block with the next lower heading level and set shouldNested to true when no equal or greater heading exists', () => {
    const result = findPrevBlock(testMap, 6)
    expect(result.prevBlock).toEqual({ le: 3, depth: 4, startBlockPos: 510, endBlockPos: 649 })
    expect(result.shouldNested).toBe(true)
  })

  test('should return the first block and set shouldNested to false when heading level is lower than all blocks', () => {
    const result = findPrevBlock(testMap, 1)
    expect(result.prevBlock).toEqual({ le: 1, depth: 0, startBlockPos: 150, endBlockPos: 653 })
    expect(result.shouldNested).toBe(false)
  })

  test('should return null for prevBlock and set shouldNested to false when mapHPost array is empty', () => {
    const result = findPrevBlock([], 3)
    expect(result.prevBlock).toEqual(null)
    expect(result.shouldNested).toBe(false)
  })

  test('should return the last block with a smaller level and set shouldNested to true if its level is smaller than the heading level', () => {
    const result = findPrevBlock(testMap, 5)
    expect(result.prevBlock).toEqual({ le: 3, depth: 4, startBlockPos: 510, endBlockPos: 649 })
    expect(result.shouldNested).toBe(true)
  })

  test('should return the closest block with a smaller heading when a larger heading exists', () => {
    const result = findPrevBlock(testMap, 2)
    expect(result.prevBlock).toEqual({ le: 2, depth: 2, startBlockPos: 411, endBlockPos: 651 })
    expect(result.shouldNested).toBe(false)
  })

  test('should return the block with the highest heading and set shouldNested to true when no block has an equal heading', () => {
    const result = findPrevBlock(testMap, 10)
    expect(result.prevBlock).toEqual({ le: 9, depth: 6, startBlockPos: 566, endBlockPos: 647 })
    expect(result.shouldNested).toBe(true)
  })

  test('should set shouldNested to true when the previous block has a lower heading', () => {
    const result = findPrevBlock(testMap, 4)
    expect(result.prevBlock).toEqual({ le: 3, depth: 4, startBlockPos: 510, endBlockPos: 649 })
    expect(result.shouldNested).toBe(true)
  })
})

describe('findPrevBlock Function - 2', () => {
  const testMap = [
    { le: 1, depth: 0, startBlockPos: 150, endBlockPos: 731 },
    { le: 2, depth: 2, startBlockPos: 411, endBlockPos: 729 },
    { le: 8, depth: 4, startBlockPos: 470, endBlockPos: 510 },
    { le: 8, depth: 4, startBlockPos: 510, endBlockPos: 588 },
    { le: 3, depth: 4, startBlockPos: 588, endBlockPos: 727 },
    { le: 9, depth: 6, startBlockPos: 644, endBlockPos: 725 }
  ]

  test('should return the previous block and set shouldNested to false when heading level matches exactly', () => {
    const result = findPrevBlock(testMap, 2)
    expect(result.prevBlock).toEqual({ le: 2, depth: 2, startBlockPos: 411, endBlockPos: 729 })
    expect(result.shouldNested).toBe(false)
  })

  test('should return the closest previous block with a greater or smaller level and set shouldNested to true when no exact match exists', () => {
    const result = findPrevBlock(testMap, 4)
    expect(result.prevBlock).toEqual({ le: 3, depth: 4, startBlockPos: 588, endBlockPos: 727 })
    expect(result.shouldNested).toBe(true)
  })

  test('should return the closest previous block with a smaller level and set shouldNested to true when multiple levels are greater', () => {
    const result = findPrevBlock(testMap, 7)
    expect(result.prevBlock).toEqual({ le: 3, depth: 4, startBlockPos: 588, endBlockPos: 727 })
    expect(result.shouldNested).toBe(true)
  })

  test('should return the first block and set shouldNested to false when heading level is less than the smallest level', () => {
    const result = findPrevBlock(testMap, 1)
    expect(result.prevBlock).toEqual({ le: 1, depth: 0, startBlockPos: 150, endBlockPos: 731 })
    expect(result.shouldNested).toBe(false)
  })

  test('should return the last block and set shouldNested to true when heading level is greater than all levels in the map', () => {
    const result = findPrevBlock(testMap, 10)
    expect(result.prevBlock).toEqual({ le: 9, depth: 6, startBlockPos: 644, endBlockPos: 725 })
    expect(result.shouldNested).toBe(true)
  })

  test('should return the last block and set shouldNested to false if the last block has a level less than or equal to the heading level', () => {
    const result = findPrevBlock(testMap, 9)
    expect(result.prevBlock).toEqual({ le: 9, depth: 6, startBlockPos: 644, endBlockPos: 725 })
    expect(result.shouldNested).toBe(false)
  })

  test('should return the last matching block and set shouldNested to true when heading level is between some blocks', () => {
    const result = findPrevBlock(testMap, 8)
    expect(result.prevBlock).toEqual({ le: 3, depth: 4, startBlockPos: 588, endBlockPos: 727 })
    expect(result.shouldNested).toBe(true)
  })
})
