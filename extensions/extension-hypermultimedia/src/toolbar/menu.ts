import { createPopover, DEFAULT_OFFSET, getDefaultController } from '@docs.plus/floating-popover'
import { attachTooltip } from '@docs.plus/floating-tooltip'

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
  // Only toggle-semantics actions (those declaring isActive) announce a pressed state.
  if (action.isActive) btn.setAttribute('aria-pressed', active ? 'true' : 'false')
  const iconMarkup = action.icon?.(ctx) ?? null
  const label = action.label(ctx)

  if (variant === 'inline') {
    btn.className = 'media-toolbar__button' + (active ? ' media-toolbar__button--active' : '')
    btn.innerHTML = iconMarkup ?? `<span>${label}</span>`
    if (!iconMarkup) btn.classList.add('media-toolbar__button--text')
    btn.setAttribute('aria-label', label)
    // Icon-only buttons get the floating tooltip; text labels self-describe.
    if (iconMarkup) attachTooltip(btn, label)
  } else {
    btn.className = 'media-toolbar__menu-item' + (active ? ' media-toolbar__menu-item--active' : '')
    btn.innerHTML = `${iconMarkup ?? ''}<span>${label}</span>`
  }
  return btn
}

/** Open `body` in a popover anchored to `anchor`; `kind` names it on the shared controller. One popover at a time; outside-click and Escape dismissal are built in. The shell stays role-neutral by doctrine — ARIA `menu` semantics would be wrong without menuitem keyboard support. */
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

/** Close the popover opened by `openToolbarPopover`, if any. */
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
