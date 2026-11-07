import { describe, expect, it } from 'bun:test'

import { peopleLabel } from '../cardText'

describe('peopleLabel', () => {
  it('stays silent below 3, then counts people, then thousands with one decimal', () => {
    expect(peopleLabel(null)).toBeNull()
    expect(peopleLabel(2)).toBeNull()
    expect(peopleLabel(3)).toBe('3 people joined')
    expect(peopleLabel(999)).toBe('999 people joined')
    expect(peopleLabel(1000)).toBe('1k people joined')
    expect(peopleLabel(12400)).toBe('12.4k people joined')
  })
})
