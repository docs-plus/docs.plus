import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { ContentWrapperBlock, EditorEventData, TIPTAP_EVENTS, TIPTAP_NODES } from '@types'
import * as PubSub from 'pubsub-js'

import { createDecorationPluginProps,createDecorationPluginState } from './decorationHelpers'

function extractContentWrapperBlocks(doc: ProseMirrorNode): ContentWrapperBlock[] {
  const result: ContentWrapperBlock[] = []
  const record = (
    from: number,
    to: number,
    nodeSize: number,
    childCount: number,
    headingId: string | null
  ) => {
    result.push({ from, to, nodeSize, childCount, headingId })
  }
  let lastHeadingId: string | null = null

  // For each node in the document
  doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (node.type.name === TIPTAP_NODES.HEADING_TYPE) {
      lastHeadingId = node.attrs.id
    }
    if (node.type.name === TIPTAP_NODES.CONTENT_WRAPPER_TYPE) {
      const nodeSize = node.content.size
      const childCount = node.childCount

      record(pos, pos + nodeSize, nodeSize, childCount, lastHeadingId)
    }
  })

  return result
}

function createCrinkleNode(prob: ContentWrapperBlock): HTMLDivElement {
  const foldEl = document.createElement('div')

  foldEl.classList.add('foldWrapper')
  const step = 2400
  const lines = 2 + Math.floor(prob.nodeSize / step)
  const clampedLines = Math.min(Math.max(lines, 2), 6)

  for (let i = 0; i <= clampedLines; i++) {
    const line = document.createElement('div')

    line.classList.add('fold')
    line.classList.add(`l${i}`)
    foldEl.append(line)
  }
  foldEl.setAttribute('data-clampedLines', (clampedLines + 1).toString())

  foldEl.addEventListener('click', (e: Event) => {
    const target = e.target as HTMLElement
    const heading = target.closest('.heading') as HTMLElement
    if (!heading?.classList.contains('closed')) return

    const headingId = heading.getAttribute('data-id')
    const open = heading.classList.contains('open') || true

    PubSub.publish(TIPTAP_EVENTS.FOLD_AND_UNFOLD, { headingId, open } as EditorEventData)
  })

  foldEl.addEventListener('mouseenter', (e: Event) => {
    const target = e.target as HTMLElement
    const heading = target.closest('.heading') as HTMLElement
    const classList = heading?.classList

    if (classList?.contains('opening') || classList?.contains('closing')) return

    const elem = target.closest('.foldWrapper') as HTMLElement
    if (elem) {
      elem.style.transitionTimingFunction = 'ease-in-out'
      elem.style.height = '70px'
    }
  })

  foldEl.addEventListener('mouseleave', (e: Event) => {
    const target = e.target as HTMLElement
    const heading = target.closest('.heading') as HTMLElement
    const classList = heading?.classList

    if (classList?.contains('opening') || classList?.contains('closing')) return

    const elem = target.closest('.foldWrapper') as HTMLElement
    if (elem) {
      elem.style.transitionTimingFunction = 'ease-in-out'
      elem.style.height = '20px'
    }
  })

  return foldEl
}

function buildDecorations(doc: ProseMirrorNode): DecorationSet {
  const decos: Decoration[] = []
  const contentWrappers = extractContentWrapperBlocks(doc)

  contentWrappers.forEach((prob) => {
    const decorationWidget = Decoration.widget(prob.from, createCrinkleNode(prob), {
      side: -1,
      key: prob.headingId || undefined
    })

    decos.push(decorationWidget)
  })

  return DecorationSet.create(doc, decos)
}

/**
 * Creates the crinkle plugin for ContentWrapper decorations
 * @returns ProseMirror plugin
 */
export function createCrinklePlugin(): Plugin {
  const targetNodeTypes = [TIPTAP_NODES.CONTENT_WRAPPER_TYPE, TIPTAP_NODES.HEADING_TYPE]

  return new Plugin({
    key: new PluginKey('crinkle'),
    state: createDecorationPluginState(buildDecorations, targetNodeTypes),
    props: createDecorationPluginProps()
  })
}
