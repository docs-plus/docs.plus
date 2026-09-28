import type { JSONContent } from '@tiptap/core'

import { containsTitleHeading } from '../../document-content/domain/sections'
import type { FragmentProblem } from '../types'

/**
 * A fragment goes into a document that already has its title. The one
 * exception is an empty document: the applier then needs the title first.
 */
export const checkFragment = (nodes: JSONContent[], intoEmpty: boolean): FragmentProblem | null => {
  if (nodes.length === 0) return 'empty'
  const [first, ...rest] = nodes
  if (intoEmpty) {
    if (!containsTitleHeading([first])) return 'missing-title'
    if (containsTitleHeading(rest)) return 'extra-title'
  } else if (containsTitleHeading(nodes)) {
    return 'title-not-allowed'
  }
  return null
}
