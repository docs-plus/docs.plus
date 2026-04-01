import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'

import { canMapDecorations, computeSection, transactionAffectsNodeType } from '../shared'
import { saveFoldedIds } from './helpers/fold-storage'

type HeadingFoldMeta =
  | { type: 'toggle'; id: string; contentHeight?: number }
  | { type: 'set'; ids: Set<string>; persist?: boolean }
  | { type: 'endAnimation'; id: string }

interface HeadingFoldState {
  foldedIds: Set<string>
  contentHeights: Map<string, number>
  animating: Map<string, 'folding' | 'unfolding'>
  decos: DecorationSet
  skipPersist: boolean
}

export interface HeadingFoldPluginOptions {
  documentId: string
  initialFoldedIds: Set<string>
  onFoldChange?: (foldedIds: Set<string>) => void
}

export const headingFoldPluginKey = new PluginKey<HeadingFoldState>('headingFold')

/** More folded content → more crinkle strips, capped for perf and layout. */
const MIN_FOLD_STRIPS = 2
const MAX_FOLD_STRIPS = 4
const CONTENT_HEIGHT_PER_STRIP = 150
const FOLD_ANIMATION_MS = 350
const ANIMATION_SAFETY_MS = 50
const FALLBACK_CONTENT_HEIGHT = 200

const stopFoldWidgetEvent = (e: Event) => e.type === 'click' || e.type === 'mousedown'

export function measureContentHeight(
  headingEl: HTMLElement,
  contentNodes: HTMLElement[],
  nextSiblingEl: HTMLElement | null
): number {
  if (contentNodes.length === 0) return 0
  const headingBottom = headingEl.getBoundingClientRect().bottom

  if (nextSiblingEl) {
    return nextSiblingEl.getBoundingClientRect().top - headingBottom
  }

  const lastNode = contentNodes[contentNodes.length - 1]
  const lastBottom = lastNode.getBoundingClientRect().bottom
  const lastMargin = parseFloat(getComputedStyle(lastNode).marginBottom) || 0
  return lastBottom - headingBottom + lastMargin
}

function isWidgetElement(el: Element): boolean {
  return el.classList.contains('heading-fold-crinkle')
}

export function findSectionDom(
  view: EditorView,
  headingId: string
): {
  headingEl: HTMLElement | null
  contentNodes: HTMLElement[]
  nextSiblingEl: HTMLElement | null
} {
  const { doc } = view.state

  const blockChildren: HTMLElement[] = []
  for (let k = 0; k < view.dom.children.length; k++) {
    const el = view.dom.children[k]
    if (el instanceof HTMLElement && !isWidgetElement(el)) {
      blockChildren.push(el)
    }
  }

  let offset = 0

  for (let i = 0; i < doc.content.childCount; i++) {
    const child = doc.content.child(i)
    const pos = offset
    offset += child.nodeSize

    if (child.type.name === 'heading' && (child.attrs['toc-id'] as string) === headingId) {
      const headingEl = blockChildren[i]
      const headingLevel = child.attrs.level as number
      const section = computeSection(doc, pos, headingLevel, i)

      const contentNodes: HTMLElement[] = []
      let contentOffset = pos + child.nodeSize
      let j = i + 1
      while (contentOffset < section.to && j < doc.content.childCount) {
        const dom = blockChildren[j]
        if (dom) contentNodes.push(dom)
        contentOffset += doc.content.child(j).nodeSize
        j++
      }

      const nextEl = blockChildren[j]
      const nextSiblingEl = nextEl ?? null

      return { headingEl, contentNodes, nextSiblingEl }
    }
  }
  return { headingEl: null, contentNodes: [], nextSiblingEl: null }
}

type FoldCrinklePhase = 'folding' | 'unfolding' | 'folded'

function createFoldWidget(
  headingId: string,
  contentHeight: number,
  view: EditorView,
  foldPhase: FoldCrinklePhase
): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'heading-fold-crinkle'
  wrapper.dataset.foldPhase = foldPhase
  wrapper.style.setProperty('--fold-content-height', `${contentHeight}px`)

  const stripCount = Math.min(
    MAX_FOLD_STRIPS,
    Math.max(
      MIN_FOLD_STRIPS,
      MIN_FOLD_STRIPS + Math.floor(contentHeight / CONTENT_HEIGHT_PER_STRIP)
    )
  )
  for (let i = 0; i < stripCount; i++) {
    wrapper.appendChild(document.createElement('div'))
  }

  wrapper.addEventListener('click', () => {
    const state = headingFoldPluginKey.getState(view.state)
    if (state?.animating.has(headingId)) return
    const { tr } = view.state
    tr.setMeta(headingFoldPluginKey, { type: 'toggle', id: headingId })
    view.dispatch(tr)
  })

  return wrapper
}

function buildFoldDecorations(
  doc: PMNode,
  state: Omit<HeadingFoldState, 'decos' | 'skipPersist'>
): DecorationSet {
  const { foldedIds, contentHeights, animating } = state
  if (foldedIds.size === 0) return DecorationSet.empty

  const decorations: Decoration[] = []
  let offset = 0
  let outerFoldEnd = -1

  for (let i = 0; i < doc.content.childCount; i++) {
    const child = doc.content.child(i)
    const pos = offset
    offset += child.nodeSize

    if (child.type.name !== 'heading') continue
    const tocId = child.attrs['toc-id'] as string
    if (!tocId || !foldedIds.has(tocId)) continue

    const phase = animating.get(tocId)
    const height = contentHeights.get(tocId) ?? FALLBACK_CONTENT_HEIGHT
    const isNested = pos < outerFoldEnd

    if (!isNested) {
      const section = computeSection(doc, pos, child.attrs.level as number, i)
      const widgetPos = pos + child.nodeSize
      const foldPhase: FoldCrinklePhase =
        phase === 'folding' ? 'folding' : phase === 'unfolding' ? 'unfolding' : 'folded'
      const widgetKey =
        phase === 'folding'
          ? `fold-${tocId}-folding`
          : phase === 'unfolding'
            ? `fold-${tocId}-unfolding`
            : `fold-${tocId}`

      decorations.push(
        Decoration.widget(widgetPos, (view) => createFoldWidget(tocId, height, view, foldPhase), {
          key: widgetKey,
          side: 1,
          stopEvent: stopFoldWidgetEvent
        })
      )

      let contentOffset = pos + child.nodeSize
      let j = i + 1
      while (contentOffset < section.to && j < doc.content.childCount) {
        const contentChild = doc.content.child(j)
        decorations.push(
          Decoration.node(contentOffset, contentOffset + contentChild.nodeSize, {
            class: 'heading-fold-hidden'
          })
        )
        contentOffset += contentChild.nodeSize
        j++
      }

      if (section.to > outerFoldEnd) {
        outerFoldEnd = section.to
      }
    }
  }

  return decorations.length > 0 ? DecorationSet.create(doc, decorations) : DecorationSet.empty
}

function pruneStaleIds(
  state: Omit<HeadingFoldState, 'decos' | 'skipPersist'>,
  doc: PMNode
): Omit<HeadingFoldState, 'decos' | 'skipPersist'> {
  if (state.foldedIds.size === 0) return state

  const liveIds = new Set<string>()
  doc.forEach((node) => {
    if (node.type.name === 'heading' && node.attrs['toc-id']) {
      liveIds.add(node.attrs['toc-id'] as string)
    }
  })

  let anyStale = false
  for (const id of state.foldedIds) {
    if (!liveIds.has(id)) {
      anyStale = true
      break
    }
  }
  if (!anyStale) return state

  const foldedIds = new Set<string>()
  const contentHeights = new Map(state.contentHeights)
  const animating = new Map(state.animating)

  for (const id of state.foldedIds) {
    if (liveIds.has(id)) {
      foldedIds.add(id)
    } else {
      contentHeights.delete(id)
      animating.delete(id)
    }
  }
  return { foldedIds, contentHeights, animating }
}

function isPositionFolded(
  doc: PMNode,
  pos: number,
  foldedIds: Set<string>
): { folded: boolean; sectionFrom: number; sectionTo: number } {
  let offset = 0

  for (let i = 0; i < doc.content.childCount; i++) {
    const child = doc.content.child(i)
    const nodePos = offset
    offset += child.nodeSize

    if (child.type.name === 'heading' && foldedIds.has(child.attrs['toc-id'] as string)) {
      const section = computeSection(doc, nodePos, child.attrs.level as number, i)
      const contentStart = nodePos + child.nodeSize
      if (pos >= contentStart && pos < section.to) {
        return { folded: true, sectionFrom: nodePos, sectionTo: section.to }
      }
    }
  }
  return { folded: false, sectionFrom: -1, sectionTo: -1 }
}

export function createHeadingFoldPlugin(
  options: HeadingFoldPluginOptions
): Plugin<HeadingFoldState> {
  let destroyed = false
  let prevFoldedIds = new Set(options.initialFoldedIds)
  let prevAnimating = new Map<string, 'folding' | 'unfolding'>()
  const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()

  return new Plugin<HeadingFoldState>({
    key: headingFoldPluginKey,

    state: {
      init(_, { doc }): HeadingFoldState {
        const foldedIds = new Set(options.initialFoldedIds)
        const contentHeights = new Map<string, number>()
        const animating = new Map<string, 'folding' | 'unfolding'>()
        const base = { foldedIds, contentHeights, animating }
        return {
          ...base,
          decos: buildFoldDecorations(doc, base),
          skipPersist: false
        }
      },

      apply(tr, prev): HeadingFoldState {
        const meta = tr.getMeta(headingFoldPluginKey) as HeadingFoldMeta | undefined

        if (meta) {
          if (meta.type === 'toggle' && meta.id) {
            if (prev.animating.has(meta.id)) return prev

            const foldedIds = new Set(prev.foldedIds)
            const contentHeights = new Map(prev.contentHeights)
            const animating = new Map(prev.animating)
            const isFolded = foldedIds.has(meta.id)

            if (isFolded) {
              animating.set(meta.id, 'unfolding')
            } else {
              foldedIds.add(meta.id)
              if (meta.contentHeight !== undefined) {
                contentHeights.set(meta.id, meta.contentHeight)
              }
              animating.set(meta.id, 'folding')
            }

            const base = { foldedIds, contentHeights, animating }
            return {
              ...base,
              decos: buildFoldDecorations(tr.doc, base),
              skipPersist: prev.skipPersist
            }
          }

          if (meta.type === 'endAnimation' && meta.id) {
            const phase = prev.animating.get(meta.id)
            if (!phase) return prev

            const foldedIds = new Set(prev.foldedIds)
            const contentHeights = new Map(prev.contentHeights)
            const animating = new Map(prev.animating)

            animating.delete(meta.id)
            if (phase === 'unfolding') {
              foldedIds.delete(meta.id)
              contentHeights.delete(meta.id)
            }

            const base = { foldedIds, contentHeights, animating }
            return {
              ...base,
              decos: buildFoldDecorations(tr.doc, base),
              skipPersist: prev.skipPersist
            }
          }

          if (meta.type === 'set' && meta.ids) {
            const base = {
              foldedIds: meta.ids,
              contentHeights: new Map<string, number>(),
              animating: new Map<string, 'folding' | 'unfolding'>()
            }
            return {
              ...base,
              decos: buildFoldDecorations(tr.doc, base),
              skipPersist: meta.persist === false
            }
          }
        }

        if (!tr.docChanged) return prev

        // Force full rebuild on Yjs remote transactions
        if (tr.getMeta('y-sync$')) {
          const pruned = pruneStaleIds(prev, tr.doc)
          return {
            ...pruned,
            decos: buildFoldDecorations(tr.doc, pruned),
            skipPersist: prev.skipPersist
          }
        }

        if (canMapDecorations(tr, tr.before)) {
          if (prev.foldedIds.size === 0) return prev
          return { ...prev, decos: prev.decos.map(tr.mapping, tr.doc) }
        }

        if (!transactionAffectsNodeType(tr, 'heading')) {
          if (prev.foldedIds.size === 0) return prev
          return { ...prev, decos: prev.decos.map(tr.mapping, tr.doc) }
        }

        const pruned = pruneStaleIds(prev, tr.doc)
        return {
          ...pruned,
          decos: buildFoldDecorations(tr.doc, pruned),
          skipPersist: prev.skipPersist
        }
      }
    },

    props: {
      decorations(state) {
        return headingFoldPluginKey.getState(state)?.decos ?? DecorationSet.empty
      },

      handleKeyDown(view, event) {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return false
        const pluginState = headingFoldPluginKey.getState(view.state)
        if (!pluginState || pluginState.foldedIds.size === 0) return false

        const { doc, selection } = view.state
        const { $head } = selection
        const isDown = event.key === 'ArrowDown'

        let offset = 0
        let currentIndex = -1
        let currentOffset = 0
        for (let i = 0; i < doc.content.childCount; i++) {
          const child = doc.content.child(i)
          if ($head.pos >= offset && $head.pos < offset + child.nodeSize) {
            currentIndex = i
            currentOffset = offset
            break
          }
          offset += child.nodeSize
        }
        if (currentIndex < 0) return false

        const nextIndex = isDown ? currentIndex + 1 : currentIndex - 1
        if (nextIndex < 0 || nextIndex >= doc.content.childCount) return false

        const nextPos = isDown
          ? currentOffset + doc.content.child(currentIndex).nodeSize
          : currentOffset - doc.content.child(nextIndex).nodeSize

        const check = isPositionFolded(doc, nextPos + 1, pluginState.foldedIds)
        if (!check.folded) return false

        if (isDown) {
          const targetPos = check.sectionTo
          if (targetPos < doc.content.size) {
            const $pos = doc.resolve(Math.min(targetPos + 1, doc.content.size))
            const tr = view.state.tr.setSelection(TextSelection.near($pos))
            view.dispatch(tr.scrollIntoView())
          }
        } else {
          const headingNode = doc.nodeAt(check.sectionFrom)
          if (headingNode) {
            const headingEnd = check.sectionFrom + headingNode.nodeSize - 1
            const $pos = doc.resolve(headingEnd)
            const tr = view.state.tr.setSelection(TextSelection.near($pos))
            view.dispatch(tr.scrollIntoView())
          }
        }

        return true
      }
    },

    view() {
      return {
        update(view) {
          const currentState = headingFoldPluginKey.getState(view.state)
          if (!currentState) return

          const { foldedIds, animating } = currentState
          if (foldedIds.size === 0 && prevFoldedIds.size === 0 && animating.size === 0) {
            return
          }

          let animChanged = animating.size !== prevAnimating.size
          for (const id of animating.keys()) {
            if (!prevAnimating.has(id)) {
              animChanged = true
              if (pendingTimers.has(id)) clearTimeout(pendingTimers.get(id))
              const timer = setTimeout(() => {
                if (destroyed) return
                pendingTimers.delete(id)
                const { tr } = view.state
                tr.setMeta(headingFoldPluginKey, {
                  type: 'endAnimation',
                  id
                })
                view.dispatch(tr)
              }, FOLD_ANIMATION_MS + ANIMATION_SAFETY_MS)
              pendingTimers.set(id, timer)
            }
          }

          let foldChanged = foldedIds.size !== prevFoldedIds.size
          if (!foldChanged) {
            for (const id of foldedIds) {
              if (!prevFoldedIds.has(id)) {
                foldChanged = true
                break
              }
            }
          }

          if (foldChanged) {
            options.onFoldChange?.(foldedIds)
            if (!currentState.skipPersist) {
              saveFoldedIds(options.documentId, foldedIds)
            }
            prevFoldedIds = new Set(foldedIds)
          }

          if (animChanged) prevAnimating = new Map(animating)
        },

        destroy() {
          destroyed = true
          for (const timer of pendingTimers.values()) clearTimeout(timer)
          pendingTimers.clear()
        }
      }
    }
  })
}
