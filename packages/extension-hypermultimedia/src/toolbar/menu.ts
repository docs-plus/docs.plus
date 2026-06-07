import { createPopover, DEFAULT_OFFSET, getDefaultController } from '@docs.plus/floating-popover'

import type { MediaAction, MediaActionContext } from './types'

export function actionButton(
  action: MediaAction,
  ctx: MediaActionContext,
  variant: 'inline' | 'row'
): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.dataset.actionId = action.id
  const active = action.isActive?.(ctx) ?? false
  const iconMarkup = action.icon?.(ctx) ?? null
  const label = action.label(ctx)

  if (variant === 'inline') {
    btn.className = 'media-toolbar__button' + (active ? ' media-toolbar__button--active' : '')
    btn.innerHTML = iconMarkup ?? `<span>${label}</span>`
    btn.title = label
    btn.setAttribute('aria-label', label)
  } else {
    btn.className = 'media-toolbar__menu-item' + (active ? ' media-toolbar__menu-item--active' : '')
    btn.innerHTML = `${iconMarkup ?? ''}<span>${label}</span>`
  }
  return btn
}

/** Open a submenu/overflow popover anchored to `anchor`; reuses the shared controller. */
export function openToolbarPopover(anchor: HTMLElement, body: HTMLElement, kind: string): void {
  const popover = createPopover({
    referenceElement: anchor,
    content: body,
    placement: 'bottom-end',
    offset: DEFAULT_OFFSET
  })
  getDefaultController().adopt(popover, kind, {
    element: popover.element,
    referenceElement: anchor
  })
  popover.show()
}

export function closeToolbarPopover(): void {
  getDefaultController().close()
}

/** Vertical overflow menu: action rows + inline-expanded submenu sections. */
export function buildOverflowMenu(
  ctx: MediaActionContext,
  menuActions: MediaAction[]
): HTMLElement {
  const menu = document.createElement('div')
  menu.className = 'media-toolbar__menu'
  for (const action of menuActions) {
    if (action.renderSubmenu) {
      const section = document.createElement('div')
      section.className = 'media-toolbar__menu-section'
      const heading = document.createElement('p')
      heading.className = 'media-toolbar__menu-heading'
      heading.textContent = action.label(ctx)
      section.append(heading, action.renderSubmenu(ctx))
      menu.append(section)
      continue
    }
    const row = actionButton(action, ctx, 'row')
    row.onclick = () => action.run?.(ctx)
    menu.append(row)
  }
  return menu
}
