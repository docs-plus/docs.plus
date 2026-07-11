import {
  appendFilterSegment,
  normalizeSlugQuery,
  removeFilterSegment,
  resetFilterPath,
  setFilterMode,
  shallowPathFromAsPath
} from '@utils/filterRoute'

describe('filterRoute', () => {
  it('normalizes slug query shapes', () => {
    expect(normalizeSlugQuery(undefined)).toEqual([])
    expect(normalizeSlugQuery('doc')).toEqual(['doc'])
    expect(normalizeSlugQuery(['doc', 'apple'])).toEqual(['doc', 'apple'])
  })

  it('builds shallow paths without origin', () => {
    expect(shallowPathFromAsPath('/doc/apple?mode=and#history')).toBe('/doc/apple?mode=and#history')
  })

  it('appends encoded filter segments and skips duplicates', () => {
    expect(appendFilterSegment('/doc', 'apple pie')).toBe('/doc/apple%20pie')
    expect(appendFilterSegment('/doc/apple', 'Apple')).toBe('/doc/apple')
    expect(appendFilterSegment('/doc/apple', 'carrot')).toBe('/doc/apple/carrot')
  })

  it('toggles filter mode in the query string', () => {
    expect(setFilterMode('/doc/apple', 'and')).toBe('/doc/apple?mode=and')
    expect(setFilterMode('/doc/apple?mode=and', 'or')).toBe('/doc/apple')
    expect(setFilterMode('/doc/apple?mode=and#history', 'or')).toBe('/doc/apple#history')
  })

  it('removes one filter segment case-insensitively', () => {
    expect(removeFilterSegment('/doc/apple/carrot', 'Apple')).toBe('/doc/carrot')
    expect(removeFilterSegment('/doc/apple', 'apple')).toBe('/doc')
    expect(removeFilterSegment('/doc/apple?mode=and', 'apple')).toBe('/doc')
  })

  it('resets to the document slug and clears mode while preserving hash', () => {
    expect(resetFilterPath('/doc/apple/carrot?mode=and#history')).toBe('/doc#history')
    expect(resetFilterPath('/doc/apple#history')).toBe('/doc#history')
  })
})
