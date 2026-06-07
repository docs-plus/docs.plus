import { useCallback, useReducer } from 'react'

import type { UseLinkSuggestionStateArgs, UseLinkSuggestionStateResult } from '../types'
import {
  initialLinkSuggestionState,
  linkSuggestionStateReducer
} from './linkSuggestionStateReducer'

export function useLinkSuggestionState({
  defaultPanel
}: UseLinkSuggestionStateArgs): UseLinkSuggestionStateResult {
  const [state, dispatch] = useReducer(
    linkSuggestionStateReducer,
    { defaultPanel },
    initialLinkSuggestionState
  )

  return {
    state,
    dispatch,
    expand: useCallback(() => dispatch({ type: 'EXPAND' }), []),
    back: useCallback(() => dispatch({ type: 'BACK' }), []),
    setQuery: useCallback((query: string) => dispatch({ type: 'QUERY_CHANGE', query }), []),
    setTotalRows: useCallback((total: number) => dispatch({ type: 'SET_TOTAL_ROWS', total }), []),
    setHighlight: useCallback(
      (index: number | null) => dispatch({ type: 'SET_HIGHLIGHT', index }),
      []
    ),
    highlightNext: useCallback(() => dispatch({ type: 'HIGHLIGHT_NEXT' }), []),
    highlightPrev: useCallback(() => dispatch({ type: 'HIGHLIGHT_PREV' }), []),
    highlightFirst: useCallback(() => dispatch({ type: 'HIGHLIGHT_FIRST' }), []),
    highlightLast: useCallback(() => dispatch({ type: 'HIGHLIGHT_LAST' }), [])
  }
}
