import { getKitStorage } from '../kitStorage'
import { createMediaToolbar } from './createMediaToolbar'
import { closeToolbarPopover } from './menu'
import type { MediaToolbarFactory, MediaToolbarOptions } from './types'

function existingToolbar(wrapper: HTMLElement): HTMLElement | null {
  return wrapper.querySelector<HTMLElement>(':scope > .media-toolbar')
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

  options.target.classList.add('hm-has-toolbar')
  options.target.append(content)
  return content
}

/** Remove the in-chrome toolbar and any open menu popover. */
export function closeMediaToolbar(wrapper?: HTMLElement | null): void {
  closeToolbarPopover()
  const root = wrapper ?? document
  // The document-wide fallback filters on [data-node-type] so host-page elements that
  // merely share the `.media-toolbar` class are never touched.
  const selector = wrapper ? '.media-toolbar' : '.media-toolbar[data-node-type]'
  root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    el.closest('.hm-has-toolbar')?.classList.remove('hm-has-toolbar')
    el.remove()
  })
}
