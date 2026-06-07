import * as Icons from '../utils/icons'
import { actionButton, buildOverflowMenu, openToolbarPopover } from './menu'
import type { MediaAction, MediaActionContext } from './types'

/** Build the in-chrome toolbar element from a resolved, sorted action list. */
export function renderMediaToolbar(ctx: MediaActionContext, actions: MediaAction[]): HTMLElement {
  const visible = actions.filter((a) => a.isVisible?.(ctx) ?? true)
  const inline = visible.filter((a) => a.placement === 'inline')
  const menu = visible.filter((a) => a.placement === 'menu')

  const bar = document.createElement('div')
  bar.className = 'media-toolbar'
  bar.setAttribute('data-node-type', ctx.nodeType)
  bar.setAttribute('role', 'toolbar')

  for (const action of inline) {
    const btn = actionButton(action, ctx, 'inline')
    if (action.renderSubmenu) {
      btn.onclick = () => openToolbarPopover(btn, action.renderSubmenu!(ctx), `media-${action.id}`)
    } else {
      btn.onclick = () => action.run?.(ctx)
    }
    bar.append(btn)
  }

  if (menu.length > 0) {
    const more = document.createElement('button')
    more.type = 'button'
    more.className = 'media-toolbar__button media-toolbar__more'
    more.title = 'More'
    more.setAttribute('aria-label', 'More actions')
    more.innerHTML = Icons.More({ size: 18 })
    more.onclick = () => openToolbarPopover(more, buildOverflowMenu(ctx, menu), 'media-menu')
    bar.append(more)
  }

  return bar
}
