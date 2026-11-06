import { isTocMoveLocked } from '@components/toc/utils/tocMove'
import { useStore } from '@stores'
import { Extension } from '@tiptap/core'
import { isChangeOrigin } from '@tiptap/extension-collaboration'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { ySyncPluginKey } from '@tiptap/y-tiptap'
import { TIPTAP_NODES } from '@types'
import { captureCollabIssueOnce } from '@utils/observability'

import { transactionAffectsNodeType } from '../shared/transaction-affects-node-type'
import { countDuplicateIds, repairHeadingIds } from './repair-heading-ids'

export interface HeadingIdRepairOptions {
  /** The open pad's documentId, for the duplicate report. */
  documentId: string | null
}

/** The Yjs origin of a repair. y-undo tracks only its own origin, so no undo stack holds it. */
export const HEADING_ID_REPAIR_ORIGIN = new PluginKey('headingIdRepair')

const SYNC_RETRY_MS = 1000
const reported = new Set<string>()

const topLevelHeadingIds = (doc: PMNode): (string | null)[] => {
  const ids: (string | null)[] = []
  doc.forEach((node) => {
    if (node.type.name === TIPTAP_NODES.HEADING_TYPE) ids.push(node.attrs['toc-id'] ?? null)
  })
  return ids
}

const sameIds = (a: readonly (string | null)[], b: readonly (string | null)[]) =>
  a.length === b.length && a.every((id, i) => id === b[i])

/**
 * Concurrent TOC moves can leave two top-level headings with one `toc-id` (#510).
 * After a peer's change, every client reports it once; an editable client repairs it.
 */
export const HeadingIdRepair = Extension.create<HeadingIdRepairOptions>({
  name: 'headingIdRepair',

  addOptions() {
    return { documentId: null }
  },

  addProseMirrorPlugins() {
    const { editor } = this
    const { documentId } = this.options
    let timer: ReturnType<typeof setTimeout> | null = null

    const repair = () => {
      timer = null
      if (editor.isDestroyed || isTocMoveLocked(editor)) return
      // Before the first server sync the client sees only its own mirror.
      if (useStore.getState().settings.editor.providerSyncing) {
        timer = setTimeout(repair, SYNC_RETRY_MS)
        return
      }
      const sync = ySyncPluginKey.getState(editor.state)
      if (!sync?.type || sync.snapshot || sync.prevSnapshot) return
      repairHeadingIds(sync.type, HEADING_ID_REPAIR_ORIGIN)
    }

    return [
      new Plugin({
        key: new PluginKey('headingIdRepairWatch'),
        appendTransaction(transactions, oldState, newState) {
          const remote = transactions.some(
            (tr) =>
              isChangeOrigin(tr) &&
              tr.docChanged &&
              transactionAffectsNodeType(tr, TIPTAP_NODES.HEADING_TYPE)
          )
          if (!remote) return null
          const ids = topLevelHeadingIds(newState.doc)
          if (sameIds(ids, topLevelHeadingIds(oldState.doc))) return null
          const duplicates = countDuplicateIds(ids)
          if (!duplicates) return null

          // Before the lock check, so read-only viewers count races too.
          if (documentId) {
            const { metadata, editor: editorSettings } = useStore.getState().settings
            captureCollabIssueOnce(
              reported,
              documentId,
              metadata.documentId === documentId ? metadata.slug : '',
              'duplicate-heading-id',
              { ...duplicates, headings: ids.length, syncing: editorSettings.providerSyncing },
              'warning'
            )
          }
          // Deferred: y-tiptap holds its binding lock while it dispatches a remote change.
          timer ??= setTimeout(repair, 0)
          return null
        },
        view: () => ({
          destroy: () => {
            if (timer) clearTimeout(timer)
            timer = null
          }
        })
      })
    ]
  }
})
