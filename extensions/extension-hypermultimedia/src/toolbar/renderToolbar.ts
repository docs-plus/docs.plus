import { attachTooltip } from '@docs.plus/floating-tooltip'

import { getKitStorage } from '../kitStorage'
import {
  actionButton,
  bindToolbarTooltips,
  buildOverflowMenu,
  openMediaPopover,
  openToolbarPopover
} from './menu'
import { resolveMediaToolbarIcon } from './resolveIcon'
import type { MediaAction, MediaActionContext } from './types'

/** Build the in-place toolbar element from a resolved action list. */
export function renderMediaToolbar(ctx: MediaActionContext, actions: MediaAction[]): HTMLElement {
  const kitIcons = getKitStorage(ctx.editor).mediaToolbarIcons
  const tooltipDetaches: (() => void)[] = []
  const inline: MediaAction[] = []
  const overflow: MediaAction[] = []
  for (const action of actions) {
    if (!(action.isVisible?.(ctx) ?? true)) continue
    if (action.placement === 'inline') inline.push(action)
    else overflow.push(action)
  }

  const bar = document.createElement('div')
  bar.className = 'media-toolbar'
  bar.setAttribute('data-node-type', ctx.nodeType)
  bar.setAttribute('role', 'toolbar')
  bar.setAttribute('aria-label', 'Media toolbar')
  // The bar sits inside the editor DOM, so ProseMirror sees its keys. Stop Enter and Space at
  // keydown, and every keypress: Enter would edit the document, and keypress cancels the click
  // on node-selected media. Backspace and Delete pass on: the editor has no focus here, so
  // the hover delete key removes the media, as docs/api.md states.
  bar.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') event.stopPropagation()
  })
  bar.addEventListener('keypress', (event) => event.stopPropagation())

  for (const action of inline) {
    const btn = actionButton(action, ctx, 'inline', kitIcons, tooltipDetaches)
    if (action.renderSubmenu) {
      btn.onclick = () => openToolbarPopover(btn, action.renderSubmenu!(ctx), `media-${action.id}`)
    } else {
      btn.onclick = () => action.run?.(ctx)
    }
    bar.append(btn)
    if (action.dividerAfter) {
      const divider = document.createElement('span')
      divider.className = 'media-toolbar__divider'
      divider.setAttribute('role', 'separator')
      divider.setAttribute('aria-orientation', 'vertical')
      bar.append(divider)
    }
  }

  if (overflow.length > 0) {
    const more = document.createElement('button')
    more.type = 'button'
    more.className = 'media-toolbar__button media-toolbar__more'
    more.setAttribute('aria-label', 'More actions')
    more.setAttribute('aria-haspopup', 'menu')
    more.setAttribute('aria-expanded', 'false')
    more.innerHTML = resolveMediaToolbarIcon(ctx, 'more', kitIcons) ?? ''
    tooltipDetaches.push(attachTooltip(more, 'More actions'))
    more.onclick = (event) => {
      const menu = buildOverflowMenu(ctx, overflow, more, kitIcons)
      openMediaPopover({
        kind: 'media-menu',
        content: menu,
        trigger: more,
        positionReference: bar,
        onHide: () => more.setAttribute('aria-expanded', 'false')
      })
      // A second click toggles the menu closed, so it never mounts.
      if (!menu.isConnected) return
      more.setAttribute('aria-expanded', 'true')
      // Enter or Space clicks with detail 0; a keyboard open moves focus to the first row.
      if (event.detail === 0) {
        menu.querySelector<HTMLElement>('[role^="menuitem"]:not(:disabled)')?.focus()
      }
    }
    bar.append(more)
  }

  bindToolbarTooltips(bar, tooltipDetaches)
  return bar
}
