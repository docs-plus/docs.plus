import type { LinkSuggestionAction, LinkSuggestionState, SuggestionPanel } from '../types'

export function initialLinkSuggestionState(args: {
  defaultPanel: SuggestionPanel
}): LinkSuggestionState {
  return {
    panel: args.defaultPanel,
    query: '',
    totalRows: 0,
    highlightIndex: null,
    defaultPanel: args.defaultPanel
  }
}

export function linkSuggestionStateReducer(
  state: LinkSuggestionState,
  action: LinkSuggestionAction
): LinkSuggestionState {
  switch (action.type) {
    case 'EXPAND':
      return state.panel === 'collapsed' ? { ...state, panel: 'browsing' } : state

    case 'BACK':
      // Mobile has no "above" panel; collapsing isn't meaningful.
      if (state.defaultPanel === 'browsing') return state
      return { ...state, panel: 'collapsed', highlightIndex: null }

    case 'QUERY_CHANGE': {
      // Empty query → 'browsing' (unfiltered list stays visible);
      // typing → 'searching'. Idempotent: same query+panel returns
      // the existing state so React skips a render.
      const next: SuggestionPanel = action.query.trim() === '' ? 'browsing' : 'searching'
      if (action.query === state.query && state.panel === next) return state
      return { ...state, query: action.query, panel: next, highlightIndex: null }
    }

    case 'SET_TOTAL_ROWS': {
      if (action.total === state.totalRows) return state
      const inRange = state.highlightIndex !== null && state.highlightIndex < action.total
      return {
        ...state,
        totalRows: action.total,
        highlightIndex: inRange ? state.highlightIndex : null
      }
    }

    case 'SET_HIGHLIGHT': {
      // Direct seek used by mouse hover; clamp into [0, totalRows) or null.
      if (action.index === null) {
        return state.highlightIndex === null ? state : { ...state, highlightIndex: null }
      }
      if (state.totalRows === 0) return state
      const clamped = Math.max(0, Math.min(action.index, state.totalRows - 1))
      return clamped === state.highlightIndex ? state : { ...state, highlightIndex: clamped }
    }

    case 'HIGHLIGHT_NEXT':
      if (state.totalRows === 0) return state
      if (state.highlightIndex === null) return { ...state, highlightIndex: 0 }
      return { ...state, highlightIndex: (state.highlightIndex + 1) % state.totalRows }

    case 'HIGHLIGHT_PREV':
      if (state.totalRows === 0) return state
      if (state.highlightIndex === null) return { ...state, highlightIndex: state.totalRows - 1 }
      return {
        ...state,
        highlightIndex: (state.highlightIndex - 1 + state.totalRows) % state.totalRows
      }

    case 'HIGHLIGHT_FIRST':
      return state.totalRows === 0 ? state : { ...state, highlightIndex: 0 }

    case 'HIGHLIGHT_LAST':
      return state.totalRows === 0 ? state : { ...state, highlightIndex: state.totalRows - 1 }
  }
}
