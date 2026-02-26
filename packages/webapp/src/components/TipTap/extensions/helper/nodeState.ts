import { logger } from '@utils/logger'

import { NodeState } from '../types'

/**
 * Retrieves the fold/unfold state for a heading section from localStorage.
 *
 * NON-COLLABORATIVE BY DESIGN: Fold state is stored per-browser in localStorage
 * and IndexedDB. Each collaborator sees their own fold state independently.
 * This is intentional — fold state is a user preference, not document state.
 * Storing it in the Yjs document would force all collaborators into the same view.
 */
export const getNodeState = (headingId: string): NodeState => {
  try {
    const headingMap = JSON.parse(localStorage.getItem('headingMap') || '[]')
    return headingMap.find((h: NodeState) => h.headingId === headingId) || { crinkleOpen: true }
  } catch (error) {
    logger.error('[nodeState] Error parsing headingMap from localStorage:', error)
    return { crinkleOpen: true }
  }
}
