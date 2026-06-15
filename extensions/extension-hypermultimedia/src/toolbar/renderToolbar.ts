import { attachTooltip } from '@docs.plus/floating-tooltip'

import * as Icons from '../utils/icons'
import { actionButton, buildOverflowMenu, openToolbarPopover } from './menu'
import type { MediaAction, MediaActionContext } from './types'

/** Build the in-place toolbar element from a resolved, sorted action list. */
export function renderMediaToolbar(ctx: MediaActionContext, actions: MediaAction[]): HTMLElement {
  const visible = actions.filter((a) => a.isVisible?.(ctx) ?? true)
  const inline = visible.filter((a) => a.placement === 'inline')
  const overflow = visible.filter((a) => a.placement === 'overflow')

  const bar = document.createElement('div')
  bar.className = 'media-toolbar'
  bar.setAttribute('data-node-type', ctx.nodeType)
  bar.setAttribute('role', 'toolbar')
  bar.setAttribute('aria-label', 'Media toolbar')

  for (const action of inline) {
    const btn = actionButton(action, ctx, 'inline')
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
    more.innerHTML = Icons.More({ size: 18 })
    attachTooltip(more, 'More actions')
    more.onclick = () => openToolbarPopover(more, buildOverflowMenu(ctx, overflow), 'media-menu')
    bar.append(more)
  }

  return bar
}
