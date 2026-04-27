import type { LinkSuggestionState } from '../types'

import {
  initialLinkSuggestionState,
  linkSuggestionStateReducer
} from './linkSuggestionStateReducer'

const desktop = (): LinkSuggestionState => initialLinkSuggestionState({ defaultPanel: 'collapsed' })
const mobile = (): LinkSuggestionState => initialLinkSuggestionState({ defaultPanel: 'browsing' })

describe('linkSuggestionStateReducer — panel transitions', () => {
  it('collapsed → browsing on EXPAND', () => {
    const out = linkSuggestionStateReducer(desktop(), { type: 'EXPAND' })
    expect(out.panel).toBe('browsing')
  })

  it('collapsed → searching when user types', () => {
    const out = linkSuggestionStateReducer(desktop(), { type: 'QUERY_CHANGE', query: 'docs' })
    expect(out.panel).toBe('searching')
    expect(out.query).toBe('docs')
  })

  it('searching → browsing when query becomes empty', () => {
    const s = linkSuggestionStateReducer(desktop(), { type: 'QUERY_CHANGE', query: 'docs' })
    const out = linkSuggestionStateReducer(s, { type: 'QUERY_CHANGE', query: '' })
    expect(out.panel).toBe('browsing')
  })

  it('browsing → collapsed on BACK (desktop)', () => {
    const s = linkSuggestionStateReducer(desktop(), { type: 'EXPAND' })
    const out = linkSuggestionStateReducer(s, { type: 'BACK' })
    expect(out.panel).toBe('collapsed')
  })

  it('BACK is a no-op on mobile (default browsing has no parent)', () => {
    const out = linkSuggestionStateReducer(mobile(), { type: 'BACK' })
    expect(out.panel).toBe('browsing')
  })
})

describe('linkSuggestionStateReducer — keyboard highlight', () => {
  it('starts with no highlight', () => {
    expect(desktop().highlightIndex).toBeNull()
  })

  it('HIGHLIGHT_NEXT wraps from last to first', () => {
    let s = desktop()
    s = { ...s, totalRows: 3, highlightIndex: 2 }
    const out = linkSuggestionStateReducer(s, { type: 'HIGHLIGHT_NEXT' })
    expect(out.highlightIndex).toBe(0)
  })

  it('HIGHLIGHT_PREV wraps from first to last', () => {
    const out = linkSuggestionStateReducer(
      { ...desktop(), totalRows: 3, highlightIndex: 0 },
      { type: 'HIGHLIGHT_PREV' }
    )
    expect(out.highlightIndex).toBe(2)
  })

  it('HIGHLIGHT_NEXT from null sets index 0', () => {
    const out = linkSuggestionStateReducer(
      { ...desktop(), totalRows: 3, highlightIndex: null },
      { type: 'HIGHLIGHT_NEXT' }
    )
    expect(out.highlightIndex).toBe(0)
  })

  it('SET_TOTAL_ROWS clears highlight when out of range', () => {
    const out = linkSuggestionStateReducer(
      { ...desktop(), totalRows: 5, highlightIndex: 4 },
      { type: 'SET_TOTAL_ROWS', total: 2 }
    )
    expect(out.highlightIndex).toBeNull()
  })

  it('SET_TOTAL_ROWS keeps highlight when still in range', () => {
    const s = { ...desktop(), totalRows: 5, highlightIndex: 1 }
    const out = linkSuggestionStateReducer(s, { type: 'SET_TOTAL_ROWS', total: 3 })
    expect(out.highlightIndex).toBe(1)
  })

  it('SET_TOTAL_ROWS returns same state when total unchanged (referential equality)', () => {
    const s = { ...desktop(), totalRows: 4, highlightIndex: 2 }
    const out = linkSuggestionStateReducer(s, { type: 'SET_TOTAL_ROWS', total: 4 })
    expect(out).toBe(s)
  })

  it('SET_HIGHLIGHT seeks directly to a valid row', () => {
    const out = linkSuggestionStateReducer(
      { ...desktop(), totalRows: 5, highlightIndex: 0 },
      { type: 'SET_HIGHLIGHT', index: 3 }
    )
    expect(out.highlightIndex).toBe(3)
  })

  it('SET_HIGHLIGHT clamps to last row when index exceeds totalRows', () => {
    const out = linkSuggestionStateReducer(
      { ...desktop(), totalRows: 3, highlightIndex: null },
      { type: 'SET_HIGHLIGHT', index: 99 }
    )
    expect(out.highlightIndex).toBe(2)
  })

  it('SET_HIGHLIGHT { index: null } clears the highlight', () => {
    const out = linkSuggestionStateReducer(
      { ...desktop(), totalRows: 3, highlightIndex: 2 },
      { type: 'SET_HIGHLIGHT', index: null }
    )
    expect(out.highlightIndex).toBeNull()
  })

  it('SET_HIGHLIGHT is a no-op when index is unchanged (referential equality)', () => {
    const s = { ...desktop(), totalRows: 5, highlightIndex: 2 }
    const out = linkSuggestionStateReducer(s, { type: 'SET_HIGHLIGHT', index: 2 })
    expect(out).toBe(s)
  })
})
