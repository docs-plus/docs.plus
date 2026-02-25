/**
 * Heading fold/unfold toggle plugin.
 *
 * NON-COLLABORATIVE BY DESIGN: Fold state is persisted per-browser in
 * IndexedDB (primary) and localStorage (cache). Each collaborator sees their
 * own fold state independently. This is intentional — fold state is a user
 * preference, not document state. Syncing it via Yjs would force all
 * collaborators into the same view, which is undesirable.
 */
import { db } from '@db/headingCrinckleDB'
import { useStore } from '@stores'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { EditorEventData, TIPTAP_EVENTS, TipTapEditor, TRANSACTION_META } from '@types'
import { logger } from '@utils/logger'
import * as PubSub from 'pubsub-js'

interface HeadingState {
  headingId: string
  crinkleOpen: boolean
}

interface StoredHeadingState extends HeadingState {
  docId?: string
  level?: number
}

let isProcessing = false

const dispatchToggleHeadingSection = (el: Element): void => {
  const headingId = el.getAttribute('data-id')
  const detailsContent = el.querySelector('div.contentWrapper')

  const event = new CustomEvent('toggleHeadingsContent', {
    detail: { headingId, el: detailsContent }
  })

  detailsContent?.dispatchEvent(event)
}

const handleHeadingToggle = ({ headingId }: EditorEventData): void => {
  if (isProcessing || !headingId) return
  isProcessing = true

  const editor = useStore.getState().settings.editor.instance
  const headingNodeEl = editor?.view.dom.querySelector<HTMLElement>(
    `.heading[data-id="${headingId}"]`
  )

  if (!editor?.view || !headingNodeEl) {
    isProcessing = false
    return
  }

  const view = editor.view
  const tr = editor.state.tr
  const nodePos = view.state.doc.resolve(view.posAtDOM(headingNodeEl, 0))
  const currentNode = tr.doc.nodeAt(nodePos.pos)

  if (!currentNode) {
    isProcessing = false
    return
  }

  tr.setMeta(TRANSACTION_META.FOLD_AND_UNFOLD, true)

  const documentId = localStorage.getItem('docId')
  const headingMapString = localStorage.getItem('headingMap')
  const headingMap: HeadingState[] = headingMapString ? JSON.parse(headingMapString) : []
  const nodeState = headingMap.find((h) => h.headingId === headingId) || { crinkleOpen: true }
  const filterMode = document.body.classList.contains('filter-mode')
  const database = filterMode ? db.docFilter : db.meta

  const dispatch = () => {
    view.dispatch(tr)
    dispatchToggleHeadingSection(headingNodeEl)
    isProcessing = false
  }

  if (filterMode) {
    dispatch()
    return
  }

  if (!documentId) {
    isProcessing = false
    return
  }

  database
    .put({
      docId: documentId,
      headingId,
      crinkleOpen: !nodeState.crinkleOpen,
      level: currentNode.attrs.level
    })
    .then(() => database.toArray())
    .then((data: StoredHeadingState[]) => {
      localStorage.setItem('headingMap', JSON.stringify(data))
    })
    .catch((err: Error) => {
      logger.error('[headingTogglePlugin] Failed to persist fold state', err)
    })
    .finally(() => {
      dispatch()
      isProcessing = false
    })
}

/**
 * Creates the heading toggle plugin for fold/unfold functionality
 * @param editor - TipTap editor instance
 * @returns ProseMirror plugin
 */
export function createHeadingTogglePlugin(_editor: TipTapEditor): Plugin {
  return new Plugin({
    key: new PluginKey('headingToggle'),
    view() {
      PubSub.subscribe(TIPTAP_EVENTS.FOLD_AND_UNFOLD, (_msg: string, data: EditorEventData) => {
        handleHeadingToggle(data)
      })

      return {
        destroy() {
          PubSub.unsubscribe(TIPTAP_EVENTS.FOLD_AND_UNFOLD)
        }
      }
    }
  })
}
