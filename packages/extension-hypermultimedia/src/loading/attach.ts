import type { Editor } from '@tiptap/core'

import { createDefaultMediaLoadingShell } from './defaultShell'
import { syncElementPixelSize } from './syncLayout'
import type {
  MediaLoadingController,
  MediaLoadingShellContext,
  MediaLoadingShellFactory,
  MediaLoadingShellOption,
  MediaLoadingShellWrapOptions
} from './types'

export const HYPER_MULTIMEDIA_KIT_EXTENSION_NAME = 'HyperMultimediaKit'

const MEDIA_READY_EVENTS = ['load', 'loadeddata', 'canplay'] as const

const NOOP_CONTROLLER: MediaLoadingController = {
  markReady: () => {},
  markError: () => {},
  destroy: () => {}
}

interface KitLoadingStorage {
  loadingShell?: MediaLoadingShellOption
}

function resolveFactory(
  option: MediaLoadingShellOption | undefined
): MediaLoadingShellFactory | null {
  if (option === false) return null
  if (typeof option === 'function') return option
  return createDefaultMediaLoadingShell
}

function createPlainMediaHost(content: HTMLElement): {
  dom: HTMLElement
  controller: MediaLoadingController
} {
  const host = document.createElement('div')
  host.className = 'hm-media-host hm-media-host--plain'
  host.append(content)
  return { dom: host, controller: NOOP_CONTROLLER }
}

function stampLoadingOverlay(overlay: HTMLElement): void {
  overlay.classList.add('hm-loading-shell', 'hm-loading-shell__overlay')
}

export function getKitLoadingShellOption(editor: Editor): MediaLoadingShellOption | undefined {
  const storage = editor.storage as Record<string, KitLoadingStorage | undefined>
  return storage[HYPER_MULTIMEDIA_KIT_EXTENSION_NAME]?.loadingShell
}

function bindMediaElementLoad(
  element: HTMLElement,
  controller: MediaLoadingController,
  isAlreadyReady: () => boolean
): () => void {
  if (isAlreadyReady()) {
    controller.markReady()
    return () => {}
  }

  function teardown(): void {
    for (const event of MEDIA_READY_EVENTS) {
      element.removeEventListener(event, onReady)
    }
    element.removeEventListener('error', onError)
  }

  const onReady = () => {
    teardown()
    controller.markReady()
  }

  const onError = () => {
    teardown()
    controller.markError()
  }

  for (const event of MEDIA_READY_EVENTS) {
    element.addEventListener(event, onReady, { once: true })
  }
  element.addEventListener('error', onError, { once: true })

  return teardown
}

export function wrapMediaWithLoadingShell(
  editor: Editor,
  context: MediaLoadingShellContext,
  content: HTMLElement,
  options?: MediaLoadingShellWrapOptions
): { dom: HTMLElement; controller: MediaLoadingController } {
  const factory = resolveFactory(getKitLoadingShellOption(editor))
  if (!factory) return createPlainMediaHost(content)

  const host = document.createElement('div')
  host.className = 'hm-media-host'
  host.dataset.hmLoading = 'pending'
  syncElementPixelSize(host, context.width, context.height)

  const overlay = factory(context)
  stampLoadingOverlay(overlay)

  const slot = document.createElement('div')
  slot.className = 'hm-media-slot'
  slot.append(content)

  host.append(overlay, slot)

  let settled = false
  let unbindLoad: (() => void) | undefined

  const settle = (): boolean => {
    if (settled) return false
    unbindLoad?.()
    unbindLoad = undefined
    settled = true
    return true
  }

  const controller: MediaLoadingController = {
    markReady: () => {
      if (!settle()) return
      host.dataset.hmLoading = 'ready'
    },
    markError: (message) => {
      if (!settle()) return
      host.dataset.hmLoading = 'error'
      const text = message ?? 'Could not load media'
      const messageEl = overlay.querySelector('.hm-loading-shell__message')
      if (messageEl) messageEl.textContent = text
      else {
        overlay.setAttribute('aria-label', text)
        host.setAttribute('aria-label', text)
      }
    },
    destroy: () => {
      settle()
    }
  }

  const bindLoad = options?.bindLoad
  if (bindLoad) {
    unbindLoad = bindMediaElementLoad(
      bindLoad.element,
      controller,
      bindLoad.isAlreadyReady ?? (() => false)
    )
  }

  return { dom: host, controller }
}
