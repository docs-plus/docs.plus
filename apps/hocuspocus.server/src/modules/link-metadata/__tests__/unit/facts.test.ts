import { describe, expect, test } from 'bun:test'

import { compactCount } from '../../domain/facts'

describe('compactCount', () => {
  test.each([
    [999, '999'],
    [1000, '1k'],
    [12_345, '12.3k'],
    // Rounds up into the next unit, never "1000k".
    [999_950, '1M'],
    [2_345_678, '2.3M']
  ])('%d → %s', (value, text) => {
    expect(compactCount(value)).toBe(text)
  })
})
