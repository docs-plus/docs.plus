import { attachTooltip } from '@docs.plus/floating-tooltip'

import { getKitStorage } from '../kitStorage'
import { actionButton, bindToolbarTooltips, buildOverflowMenu, openToolbarPopover } from './menu'
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
    more.innerHTML = resolveMediaToolbarIcon(ctx, 'more', kitIcons) ?? ''
    tooltipDetaches.push(attachTooltip(more, 'More actions'))
    more.onclick = () =>
      openToolbarPopover(more, buildOverflowMenu(ctx, overflow, kitIcons), 'media-menu', {
        positionReference: bar
      })
    bar.append(more)
  }

  bindToolbarTooltips(bar, tooltipDetaches)
  return bar
}
