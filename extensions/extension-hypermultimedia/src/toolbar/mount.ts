import { hideTooltip } from '@docs.plus/floating-tooltip'

import { getKitStorage } from '../kitStorage'
import { createMediaToolbar } from './createMediaToolbar'
import { closeToolbarPopover } from './menu'
import type { MediaToolbarFactory, MediaToolbarOptions } from './types'

function existingToolbar(wrapper: HTMLElement): HTMLElement | null {
  return wrapper.querySelector<HTMLElement>(':scope > [data-hm-toolbar]')
}

/** Mount the toolbar inside the media wrapper (absolute top-right). `null` ⇒ host surface. */
export function openMediaToolbar(
  options: MediaToolbarOptions,
  factory?: MediaToolbarFactory
): HTMLElement | null {
  const reused = existingToolbar(options.target)
  if (reused) return reused

  const resolved: MediaToolbarFactory =
    factory ?? getKitStorage(options.editor).mediaToolbar ?? createMediaToolbar

  const content = resolved(options)
  if (!content) return null

  // Structural lifecycle marker: reuse and removal key on it, so custom
  // factories get both without adopting the built-in `.media-toolbar` skin.
  content.dataset.hmToolbar = ''
  options.target.classList.add('hm-has-toolbar')
  options.target.append(content)
  return content
}

/** Remove the mounted toolbar, any open menu popover, and a lingering tooltip. */
export function closeMediaToolbar(wrapper?: HTMLElement | null): void {
  closeToolbarPopover()
  hideTooltip()
  const root = wrapper ?? document
  root.querySelectorAll<HTMLElement>('[data-hm-toolbar]').forEach((el) => {
    el.closest('.hm-has-toolbar')?.classList.remove('hm-has-toolbar')
    el.remove()
  })
}
