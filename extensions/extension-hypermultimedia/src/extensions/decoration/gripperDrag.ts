import { getDefaultController } from '@docs.plus/floating-popover'
import { Editor } from '@tiptap/core'

import {
  resolveMediaNodePos,
  restoreControlsAfterResize,
  setMediaResizing
} from '../../utils/media-resize-controls'
import { getMediaNodeType, resolveMediaFromGripper } from '../../utils/media-target'
import { ClampType, Corner, ResizeConstraints, ResizeState } from './types'
import {
  clampDimensionsToConstraints,
  getPointerPosition,
  keepsCornerAspectRatio,
  readGripperDimensions,
  resetGripperPosition,
  resolveMediaNodeConstraints,
  updateNodeDimensions
} from './utils'

// One in-flight drag per editor. The gripper plugin's `view().destroy()` calls
// `abortActiveGripperDrag` so an editor torn down mid-drag drops the window/
// document listeners and pointer capture instead of leaking them. WeakMap keys
// are GC-safe, so a destroyed editor needs no explicit removal.
const activeDragByEditor = new WeakMap<Editor, () => void>()

export function abortActiveGripperDrag(editor: Editor): void {
  activeDragByEditor.get(editor)?.()
}

interface GripperSize {
  width: number
  height: number
}

interface GripperBox extends GripperSize {
  top: number
  left: number
}

interface GripperDragContext {
  deltaX: number
  deltaY: number
  state: ResizeState
  clamp: HTMLElement
}

function isLeftEdge(clamp: HTMLElement): boolean {
  return (
    clamp.classList.contains(ClampType.Left) ||
    clamp.classList.contains(ClampType.TopLeft) ||
    clamp.classList.contains(ClampType.BottomLeft)
  )
}

function isTopEdge(clamp: HTMLElement): boolean {
  return (
    clamp.classList.contains(ClampType.Top) ||
    clamp.classList.contains(ClampType.TopLeft) ||
    clamp.classList.contains(ClampType.TopRight)
  )
}

/** The handle's own edge moves; the opposite edge stays put. */
function clampGripperBox(
  size: GripperSize,
  state: ResizeState,
  clamp: HTMLElement,
  constraints: ResizeConstraints
): GripperBox {
  const { width, height } = clampDimensionsToConstraints(
    size.width,
    size.height,
    constraints,
    state.lockedRatio
  )
  return {
    width,
    height,
    top: isTopEdge(clamp) ? state.initialTop + state.initialHeight - height : state.initialTop,
    left: isLeftEdge(clamp) ? state.initialLeft + state.initialWidth - width : state.initialLeft
  }
}

interface GripperDragConfig {
  clamp: HTMLElement
  gripper: HTMLElement
  editor: Editor
  /** Set on a corner handle; a side handle omits it. */
  corner?: Corner
}

/** Pointer-capture class on the gripper widget during a drag — never mutate node-view DOM. */
function setGripperDragging(gripper: HTMLElement, dragging: boolean): void {
  gripper.classList.toggle('hypermultimedia__resize-gripper--dragging', dragging)
  document.documentElement.classList.toggle('hypermultimedia--resize-dragging', dragging)
}

/**
 * Keyed-widget DOM reuse keeps this gripper (and its decoration-time positions)
 * alive across edits above the node. The doc position must therefore be
 * re-resolved from the DOM at drag end. Never trust `MediaGripperInfo.from`.
 */
function resolveDragTargetPos(editor: Editor, gripper: HTMLElement): number | null {
  const media = resolveMediaFromGripper(gripper, editor.view.dom)
  if (!media) return null
  const nodeType = getMediaNodeType(media)
  if (!nodeType) return null
  return resolveMediaNodePos(editor.view, media, nodeType)
}

/** Wire one clamp's pointer drag onto the shared resize lifecycle. */
export function attachGripperDrag(config: GripperDragConfig): void {
  const { clamp, gripper, editor, corner } = config

  function handleStart(event: Event) {
    if (!(event instanceof PointerEvent)) return
    if (event.button !== 0) return

    event.preventDefault()
    event.stopPropagation()

    const pointerId = event.pointerId
    let ended = false
    let pointerMoveActive = false

    setMediaResizing(editor, true)
    setGripperDragging(gripper, true)
    getDefaultController().close()

    try {
      clamp.setPointerCapture(pointerId)
    } catch {
      setGripperDragging(gripper, false)
      setMediaResizing(editor, false)
      return
    }

    const start = getPointerPosition(event)
    const nodePos = resolveDragTargetPos(editor, gripper)
    const node = nodePos != null ? editor.state.doc.nodeAt(nodePos) : null
    const constraints = resolveMediaNodeConstraints(editor, node)

    const state: ResizeState = {
      initialX: start.x,
      initialY: start.y,
      initialWidth: gripper.offsetWidth,
      initialHeight: gripper.offsetHeight,
      initialTop: gripper.offsetTop,
      initialLeft: gripper.offsetLeft,
      lockedRatio:
        corner && keepsCornerAspectRatio(node) ? gripper.offsetWidth / gripper.offsetHeight : null
    }

    function applyMove(clientX: number, clientY: number) {
      const ctx = {
        deltaX: clientX - state.initialX,
        deltaY: clientY - state.initialY,
        state,
        clamp
      }
      const size = corner ? computeCornerSize(corner, ctx) : computeSideSize(ctx)
      const box = clampGripperBox(size, state, clamp, constraints)

      gripper.style.width = `${box.width}px`
      gripper.style.height = `${box.height}px`
      gripper.style.top = `${box.top}px`
      gripper.style.left = `${box.left}px`
    }

    function ensurePointerCapture() {
      if (ended || clamp.hasPointerCapture(pointerId)) return
      try {
        clamp.setPointerCapture(pointerId)
      } catch {
        // window listeners keep the drag alive until pointer/mouse up
      }
    }

    function onPointerMove(ev: PointerEvent) {
      if (ended || ev.pointerId !== pointerId) return
      ev.preventDefault()
      pointerMoveActive = true
      ensurePointerCapture()
      applyMove(ev.clientX, ev.clientY)
    }

    function onMouseMove(ev: MouseEvent) {
      if (ended || pointerMoveActive || (ev.buttons & 1) === 0) return
      ev.preventDefault()
      applyMove(ev.clientX, ev.clientY)
    }

    function finish(ev?: Event) {
      if (ended) return
      if (ev instanceof PointerEvent && ev.pointerId !== pointerId) return
      ended = true

      const { width, height } = readGripperDimensions(gripper)
      resetGripperPosition(gripper, state.initialLeft, state.initialTop)
      const nodePos = resolveDragTargetPos(editor, gripper)

      try {
        if (nodePos !== null) {
          updateNodeDimensions(editor, nodePos, width, height, state.lockedRatio)
        }
      } finally {
        // Listeners and pointer capture must release even when the commit throws.
        teardown()
        setGripperDragging(gripper, false)
        activeDragByEditor.delete(editor)
        restoreControlsAfterResize(editor, gripper, nodePos ?? undefined)
      }
    }

    // Escape drops the preview without committing: restore the gripper box, then re-arm hover controls.
    function cancel() {
      if (ended) return
      ended = true

      gripper.style.width = `${state.initialWidth}px`
      gripper.style.height = `${state.initialHeight}px`
      resetGripperPosition(gripper, state.initialLeft, state.initialTop)

      teardown()
      setGripperDragging(gripper, false)
      activeDragByEditor.delete(editor)
      restoreControlsAfterResize(editor, gripper)
    }

    function onWindowBlur() {
      finish()
    }

    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key === 'Escape') cancel()
    }

    type ListenerBinding = [EventTarget, string, EventListener]

    // Window pointer + mouse fallbacks keep drag alive across iframe overlays and Cypress.
    const bindings: ListenerBinding[] = [
      [clamp, 'pointermove', onPointerMove as EventListener],
      [clamp, 'pointerup', finish],
      [clamp, 'pointercancel', finish],
      [window, 'pointermove', onPointerMove as EventListener],
      [window, 'pointerup', finish],
      [window, 'pointercancel', finish],
      [window, 'mousemove', onMouseMove as EventListener],
      [window, 'mouseup', finish],
      [window, 'blur', onWindowBlur],
      [document, 'keydown', onKeyDown as EventListener]
    ]

    function setDragListeners(active: boolean): void {
      for (const [target, type, listener] of bindings) {
        target[active ? 'addEventListener' : 'removeEventListener'](type, listener)
      }
    }

    function teardown() {
      setDragListeners(false)
      try {
        if (clamp.hasPointerCapture(pointerId)) clamp.releasePointerCapture(pointerId)
      } catch {
        // capture may already be released
      }
    }

    // Editor destroyed mid-drag: release listeners + visual state without
    // touching the now-dead view (finish() dispatches a transaction and would
    // throw). A later stray pointerup hits the `ended` guard and no-ops.
    function abort() {
      if (ended) return
      ended = true
      teardown()
      setGripperDragging(gripper, false)
      setMediaResizing(editor, false)
      activeDragByEditor.delete(editor)
    }

    setDragListeners(true)
    activeDragByEditor.set(editor, abort)
  }

  clamp.addEventListener('pointerdown', handleStart)
}

/** Side handles: one axis, no aspect ratio. */
function computeSideSize({ deltaX, deltaY, state, clamp }: GripperDragContext): GripperSize {
  let width = state.initialWidth
  let height = state.initialHeight
  if (clamp.classList.contains(ClampType.Left)) width -= deltaX
  else if (clamp.classList.contains(ClampType.Right)) width += deltaX
  else if (clamp.classList.contains(ClampType.Top)) height -= deltaY
  else if (clamp.classList.contains(ClampType.Bottom)) height += deltaY
  return { width, height }
}

/** Corner handles: with a locked ratio, the larger pointer move drives one axis. */
function computeCornerSize(
  corner: Corner,
  { deltaX, deltaY, state }: GripperDragContext
): GripperSize {
  const width = state.initialWidth + (corner.endsWith('Left') ? -deltaX : deltaX)
  const height = state.initialHeight + (corner.startsWith('top') ? -deltaY : deltaY)
  const ratio = state.lockedRatio
  if (!ratio) return { width, height }
  return Math.abs(deltaX) > Math.abs(deltaY)
    ? { width, height: width / ratio }
    : { width: height * ratio, height }
}
