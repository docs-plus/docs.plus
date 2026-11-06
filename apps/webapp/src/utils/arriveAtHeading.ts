import {
  foldedSectionsAt,
  type HeadingFoldMeta,
  headingFoldPluginKey
} from '@components/TipTap/extensions/heading-fold'
import { outlineOf } from '@components/toc/utils/outline'
import { useStore } from '@stores'

import { scrollToHeading } from './scrollToHeading'

/**
 * A heading link lands here, from a click or a cold `?id=`. It opens only the folds that
 * hide the heading, for this session, then scrolls the heading to the top of the pad.
 */
export function arriveAtHeading(headingId: string): void {
  const editor = useStore.getState().settings.editor.instance
  if (!editor || editor.isDestroyed) return

  const { doc } = editor.state
  // `toc-id` is on links and tables too; the outline holds top-level headings only.
  const headingPos = outlineOf(doc).find((n) => n.id === headingId)?.pos
  if (headingPos === undefined) return

  const foldedIds = headingFoldPluginKey.getState(editor.state)?.foldedIds
  const hiding = foldedIds ? foldedSectionsAt(doc, headingPos, foldedIds) : []
  if (hiding.length > 0) {
    const ids = new Set(hiding.map((section) => section.id))
    const { tr } = editor.state
    editor.view.dispatch(
      tr.setMeta(headingFoldPluginKey, { type: 'reveal', ids } satisfies HeadingFoldMeta)
    )
  }
  scrollToHeading(headingId, { block: 'start' })
}
