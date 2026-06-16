import { hideTooltip } from '@docs.plus/floating-tooltip'

import { getKitStorage } from '../kitStorage'
import { createMediaToolbar } from './createMediaToolbar'
import { closeToolbarPopover } from './menu'
import type { MediaToolbarFactory, MediaToolbarOptions } from './types'

// 80ms CSS opacity fade plus a short buffer before DOM removal; closing bars are not reused.
const CLOSE_REMOVE_DELAY_MS = 100

function existingToolbar(wrapper: HTMLElement): HTMLElement | null {
  const live = wrapper.querySelector<HTMLElement>(
    ':scope > [data-hm-toolbar]:not([data-hm-closing])'
  )
  if (live) return live

  // Re-hover before removal fires can stack a second bar; purge closing siblings first.
  wrapper
    .querySelectorAll(':scope > [data-hm-toolbar][data-hm-closing]')
    .forEach((el) => el.remove())
  wrapper.classList.remove('hm-has-toolbar')
  return null
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
  // Enter fades via the hm-toolbar-in keyframe (fires on class match at mount);
  // the exit fade + reuse-safety live on the data-hm-closing guard below.
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
    // Deferred removal lets the 80ms exit fade play. Reopen sync-purges via existingToolbar().
    el.dataset.hmClosing = 'true'
    setTimeout(() => el.remove(), CLOSE_REMOVE_DELAY_MS)
  })
}
