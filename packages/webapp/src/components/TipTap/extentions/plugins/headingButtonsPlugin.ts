import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { createDecorationPluginState, createDecorationPluginProps } from './decorationHelpers'
import {
  TipTapEditor,
  EditorEventData,
  TIPTAP_EVENTS,
  TIPTAP_NODES,
  TRANSACTION_META,
  type ProseMirrorNode
} from '@types'
import * as PubSub from 'pubsub-js'
import { copyToClipboard } from '../helper'
import { CHAT_OPEN } from '@services/eventsHub'
import { ChatLeftSVG, ArrowDownSVG } from '@icons'
import { db } from '@db/headingCrinckleDB'
import { useStore } from '@stores'

// Plugin-specific types
interface HeadingBlock {
  from: number
  to: number
  headingId: string
  node: ProseMirrorNode
}

interface HeadingState {
  headingId: string
  crinkleOpen: boolean
}

// Add processing state
let isProcessing = false

const extractContentHeadingBlocks = (doc: ProseMirrorNode): HeadingBlock[] => {
  const result: HeadingBlock[] = []
  const record = (from: number, to: number, headingId: string, node: ProseMirrorNode): void => {
    result.push({ from, to, headingId, node })
  }
  let lastHeadingId: string | undefined

  // For each node in the document
  doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (node.type.name === TIPTAP_NODES.HEADING_TYPE) {
      lastHeadingId = node.attrs.id
    }
    if (node.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE) {
      const nodeSize = node.nodeSize

      if (lastHeadingId) {
        record(pos, pos + nodeSize, lastHeadingId, node)
      }
    }
  })

  return result
}

const dispatchToggleHeadingSection = (el: Element): void => {
  const headingId = el.getAttribute('data-id')
  const detailsContent = el.querySelector('div.contentWrapper')

  const event = new CustomEvent('toggleHeadingsContent', {
    detail: { headingId, el: detailsContent }
  })

  detailsContent?.dispatchEvent(event)
}

const buttonWrapper = (
  editor: TipTapEditor,
  { headingId, from, node }: HeadingBlock
): HTMLDivElement => {
  const buttonWrapper = document.createElement('div')
  const btnToggleHeading = document.createElement('button')
  const btnChatBox = document.createElement('button')
  const btnDesktopChatBox = document.createElement('button')

  buttonWrapper.classList.add('buttonWrapper')
  btnDesktopChatBox.classList.add('btnDesktopChatBox')

  btnChatBox.setAttribute('class', 'btn_openChatBox')
  btnChatBox.setAttribute('type', 'button')
  btnToggleHeading.classList.add('btnFold')
  btnToggleHeading.setAttribute('type', 'button')

  const chatLeftSvg = ChatLeftSVG({ size: 20, className: 'chatLeft' })
  const arrowDownSvg = ArrowDownSVG({ size: 20, className: 'arrowDown' })

  btnChatBox.innerHTML = chatLeftSvg + arrowDownSvg
  btnDesktopChatBox.innerHTML = chatLeftSvg

  btnChatBox.addEventListener('click', (e: Event) => {
    e.preventDefault()
    e.stopPropagation()

    // On mobile, blur to close keyboard before opening chat
    const isMobile = window.innerWidth <= 768
    if (isMobile && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    PubSub.publish(CHAT_OPEN, {
      headingId,
      focusEditor: false
    })

    // Only focus editor on desktop - on mobile this would reopen keyboard
    if (!isMobile) {
      editor
        .chain()
        .focus(from + node.nodeSize - 1)
        .run()
    }
  })

  // copy the link to clipboard
  const href = document.createElement('span')

  href.innerHTML = '#'
  href.setAttribute('href', `?id=${headingId}`)
  href.setAttribute('target', `_tab`)
  href.setAttribute('rel', `noreferrer`)
  href.classList.add('btn_copyLink')
  href.addEventListener('click', (e: Event) => {
    e.preventDefault()
    const url = new URL(window.location.href)

    url.searchParams.set('id', headingId)
    window.history.pushState({}, '', url.toString())
    copyToClipboard(url.href, () => {
      console.info('Link copied to clipboard')
    })
    editor
      .chain()
      .focus(from + node.nodeSize - 1)
      .run()
  })
  href.contentEditable = 'false'

  buttonWrapper.append(href, btnDesktopChatBox, btnToggleHeading, btnChatBox)

  return buttonWrapper
}

const appendButtonsDec = (doc: ProseMirrorNode, editor: TipTapEditor): DecorationSet => {
  const decos: Decoration[] = []
  const contentWrappers = extractContentHeadingBlocks(doc)

  contentWrappers.forEach((prob: HeadingBlock) => {
    const decorationWidget = Decoration.widget(prob.to, buttonWrapper(editor, prob), {
      side: -1,
      key: prob.headingId,
      ignoreSelection: true
    })

    decos.push(decorationWidget)
  })

  return DecorationSet.create(doc, decos)
}

const handleHeadingToggle = (_editor: TipTapEditor, { headingId }: EditorEventData): void => {
  if (isProcessing || !headingId) return
  isProcessing = true

  // Get editor from store - safer than using passed reference
  const editor = useStore.getState().settings.editor.instance
  const headingNodeEl = document.querySelector(
    `.ProseMirror .heading[data-id="${headingId}"]`
  ) as HTMLElement | null

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

  // In filter mode, skip saving to DB
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
    .then(() => {
      database.toArray().then((data: any[]) => {
        localStorage.setItem('headingMap', JSON.stringify(data))
      })
      dispatch()
    })
    .catch((err: Error) => {
      console.error(err)
      isProcessing = false
    })
}

/**
 * Creates the heading buttons plugin for ContentHeading decorations
 * @param editor - TipTap editor instance
 * @returns ProseMirror plugin
 */
export function createHeadingButtonsPlugin(editor: TipTapEditor): Plugin {
  const targetNodeTypes = [TIPTAP_NODES.HEADING_TYPE, TIPTAP_NODES.CONTENT_HEADING_TYPE]

  const initCallback = (): void => {
    PubSub.subscribe(TIPTAP_EVENTS.FOLD_AND_UNFOLD, (msg: string, data: EditorEventData) => {
      handleHeadingToggle(editor, data)
    })
  }

  const buildDecorations = (doc: ProseMirrorNode): DecorationSet => appendButtonsDec(doc, editor)

  return new Plugin({
    key: new PluginKey('HeadingButtons'),
    state: createDecorationPluginState(buildDecorations, targetNodeTypes, initCallback),
    props: createDecorationPluginProps(),
    destroy() {
      PubSub.unsubscribe(TIPTAP_EVENTS.FOLD_AND_UNFOLD)
      console.info('destroy handleHeadingToggle')
    }
  })
}
