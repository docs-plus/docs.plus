import { Plugin, PluginKey } from '@tiptap/pm/state'
import { DecorationSet } from '@tiptap/pm/view'

import {
  canMapDecorations,
  computeSection,
  moveSection,
  transactionAffectsNodeType
} from '../shared'
import {
  applySectionFeedback,
  AUTO_SCROLL_SPEED,
  AUTO_SCROLL_ZONE,
  buildHandleDecos,
  cleanupDrag,
  DRAG_THRESHOLD,
  type DragInfo,
  dragStates,
  findDropTarget,
  getScrollParent
} from './helpers/drag-helpers'
import { findHeadingFromCursor } from './helpers/find-heading-from-cursor'
import { repositionHandle } from './helpers/reposition-handle'

const headingDragPluginKey = new PluginKey<DecorationSet>('headingDrag')

export function createHeadingDragPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: headingDragPluginKey,

    state: {
      init(_, state) {
        return buildHandleDecos(state.doc)
      },

      apply(tr, prev, oldState, newState) {
        if (!tr.docChanged) return prev
        if (tr.getMeta('y-sync$')) return buildHandleDecos(newState.doc)
        if (canMapDecorations(tr, oldState.doc)) {
          return prev.map(tr.mapping, newState.doc)
        }
        if (!transactionAffectsNodeType(tr, 'heading')) {
          return prev.map(tr.mapping, newState.doc)
        }
        return buildHandleDecos(newState.doc)
      }
    },

    props: {
      decorations(state) {
        return headingDragPluginKey.getState(state) ?? DecorationSet.empty
      }
    },

    view(editorView) {
      const wrapperEl = document.createElement('div')
      wrapperEl.className = 'heading-drag-wrapper'
      Object.assign(wrapperEl.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        pointerEvents: 'none'
      })

      const handleEl = document.createElement('div')
      handleEl.className = 'heading-drag-handle'
      wrapperEl.appendChild(handleEl)

      let mountedParent: HTMLElement | null = null
      let currentHeadingEl: HTMLElement | null = null
      let pendingMouseCoords: { x: number; y: number } | null = null
      let positionRafId = 0

      function showHandle(): void {
        wrapperEl.style.visibility = ''
        handleEl.style.pointerEvents = 'auto'
      }

      function hideHandle(): void {
        wrapperEl.style.visibility = 'hidden'
        handleEl.style.pointerEvents = 'none'
        currentHeadingEl = null
      }

      function schedulePositionUpdate(): void {
        if (positionRafId) return
        positionRafId = requestAnimationFrame(async () => {
          positionRafId = 0
          if (!pendingMouseCoords || dragStates.has(editorView)) return

          const result = findHeadingFromCursor(editorView, pendingMouseCoords)
          if (result) {
            currentHeadingEl = result.element
            await repositionHandle(wrapperEl, result.element)
            showHandle()
          } else {
            hideHandle()
          }
        })
      }

      function onParentMouseMove(e: MouseEvent): void {
        pendingMouseCoords = { x: e.clientX, y: e.clientY }
        schedulePositionUpdate()
      }

      function onKeyDown(): void {
        hideHandle()
      }

      function onParentMouseLeave(): void {
        hideHandle()
      }

      function onHandleMouseDown(e: MouseEvent): void {
        if (e.button !== 0 || !currentHeadingEl) return

        cleanupDrag(editorView)

        const headingEl = currentHeadingEl
        const pos = editorView.posAtDOM(headingEl, 0) - 1
        if (pos <= 0) return

        const { doc } = editorView.state
        const headingNode = doc.nodeAt(pos)
        if (!headingNode || headingNode.type.name !== 'heading') return

        const headingLevel = headingNode.attrs.level as number
        const headingText = headingNode.textContent || 'Heading'
        const section = computeSection(doc, pos, headingLevel)

        const startX = e.clientX
        const startY = e.clientY
        let activated = false
        let latestClientY = e.clientY

        const info: DragInfo = {
          headingPos: pos,
          headingLevel,
          sectionFrom: section.from,
          sectionTo: section.to,
          ghostEl: null,
          indicatorEl: null,
          scrollInterval: null,
          onDocMouseMove: null,
          onDocMouseUp: null,
          onBlur: null,
          rafId: 0
        }

        const scrollParent = getScrollParent(editorView.dom as HTMLElement)

        const onDragMove = (ev: MouseEvent): void => {
          latestClientY = ev.clientY

          if (!activated) {
            const dx = ev.clientX - startX
            const dy = ev.clientY - startY
            if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return

            activated = true
            document.documentElement.classList.add('heading-dragging')
            applySectionFeedback(editorView, info.sectionFrom, info.sectionTo)
            hideHandle()

            const ghost = document.createElement('div')
            ghost.className = 'heading-drag-ghost'
            ghost.textContent = headingText
            document.body.appendChild(ghost)
            info.ghostEl = ghost

            info.scrollInterval = setInterval(() => {
              const viewportHeight = window.innerHeight
              if (latestClientY < AUTO_SCROLL_ZONE) {
                scrollParent.scrollBy(0, -AUTO_SCROLL_SPEED)
              } else if (latestClientY > viewportHeight - AUTO_SCROLL_ZONE) {
                scrollParent.scrollBy(0, AUTO_SCROLL_SPEED)
              }
            }, 16)
          }

          if (info.ghostEl) {
            info.ghostEl.style.left = `${ev.clientX + 12}px`
            info.ghostEl.style.top = `${ev.clientY - 16}px`
          }

          cancelAnimationFrame(info.rafId)
          const { clientY } = ev
          info.rafId = requestAnimationFrame(() => {
            const target = findDropTarget(editorView, clientY, info.sectionFrom, info.sectionTo)

            if (!target) {
              info.indicatorEl?.remove()
              info.indicatorEl = null
              return
            }

            const parentEl = mountedParent ?? editorView.dom.parentElement
            if (!parentEl) return

            if (!info.indicatorEl) {
              info.indicatorEl = document.createElement('div')
              info.indicatorEl.className = 'heading-drop-indicator'
              parentEl.appendChild(info.indicatorEl)
            }

            const parentRect = parentEl.getBoundingClientRect()
            const editorRect = editorView.dom.getBoundingClientRect()
            info.indicatorEl.style.top = `${target.y - parentRect.top}px`
            info.indicatorEl.style.left = `${editorRect.left - parentRect.left}px`
            info.indicatorEl.style.width = `${editorRect.width}px`
          })
        }

        const onDragUp = (ev: MouseEvent): void => {
          if (!activated) {
            cleanupDrag(editorView)
            return
          }

          const { sectionFrom, sectionTo } = info
          const target = findDropTarget(editorView, ev.clientY, sectionFrom, sectionTo)

          cleanupDrag(editorView)

          if (!target || target.pos === sectionFrom || target.pos === sectionTo) {
            return
          }

          const { tr, doc: currentDoc } = editorView.state
          moveSection(tr, currentDoc, sectionFrom, sectionTo, target.pos)
          editorView.dispatch(tr.scrollIntoView())
        }

        const onBlur = (): void => {
          cleanupDrag(editorView)
        }

        info.onDocMouseMove = onDragMove
        info.onDocMouseUp = onDragUp
        info.onBlur = onBlur
        dragStates.set(editorView, info)

        document.addEventListener('mousemove', onDragMove)
        document.addEventListener('mouseup', onDragUp)
        editorView.dom.addEventListener('blur', onBlur)

        e.preventDefault()
      }

      function unmountParent(): void {
        if (!mountedParent) return
        mountedParent.removeEventListener('mousemove', onParentMouseMove)
        mountedParent.removeEventListener('mouseleave', onParentMouseLeave)
        wrapperEl.remove()
        mountedParent = null
      }

      function mount(): boolean {
        const parentEl = editorView.dom.parentElement
        if (!parentEl) return false

        if (mountedParent === parentEl) return true

        unmountParent()

        mountedParent = parentEl
        parentEl.style.position = 'relative'
        parentEl.appendChild(wrapperEl)
        hideHandle()

        parentEl.addEventListener('mousemove', onParentMouseMove)
        parentEl.addEventListener('mouseleave', onParentMouseLeave)

        return true
      }

      editorView.dom.addEventListener('keydown', onKeyDown)
      handleEl.addEventListener('mousedown', onHandleMouseDown)
      mount()

      return {
        update() {
          mount()
        },

        destroy() {
          cleanupDrag(editorView)
          cancelAnimationFrame(positionRafId)
          unmountParent()
          editorView.dom.removeEventListener('keydown', onKeyDown)
          handleEl.removeEventListener('mousedown', onHandleMouseDown)
          wrapperEl.remove()
        }
      }
    }
  })
}
