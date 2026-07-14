import { createPopover, DEFAULT_OFFSET, getDefaultController } from '@docs.plus/floating-popover'
import { attachTooltip } from '@docs.plus/floating-tooltip'

import { type MediaToolbarIconsResolver, resolveMediaToolbarIcon } from './resolveIcon'
import type { MediaAction, MediaActionContext } from './types'

/** Tuck menus under the bar — DEFAULT_OFFSET (8) leaves a visible gutter. */
const TOOLBAR_MENU_OFFSET = 2

const POPOVER_BY_VARIANT = {
  menu: {
    placement: 'bottom-end' as const,
    offset: TOOLBAR_MENU_OFFSET,
    crossAxisShift: false
  },
  dialog: {
    placement: 'bottom' as const,
    offset: DEFAULT_OFFSET
  }
} as const

const toolbarTooltipDetaches = new WeakMap<HTMLElement, (() => void)[]>()

export function bindToolbarTooltips(bar: HTMLElement, detaches: (() => void)[]): void {
  toolbarTooltipDetaches.set(bar, detaches)
}

export function releaseToolbarTooltips(bar: HTMLElement): void {
  toolbarTooltipDetaches.get(bar)?.forEach((detach) => detach())
  toolbarTooltipDetaches.delete(bar)
}

export function actionButton(
  action: MediaAction,
  ctx: MediaActionContext,
  variant: 'inline' | 'row',
  icons?: MediaToolbarIconsResolver | null,
  tooltipDetaches?: (() => void)[]
): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.dataset.actionId = action.id
  const active = action.isActive?.(ctx) ?? false
  // Only toggle-semantics actions (those declaring isActive) announce a pressed state.
  if (action.isActive) btn.setAttribute('aria-pressed', active ? 'true' : 'false')
  const iconMarkup = action.icon?.(ctx) ?? resolveMediaToolbarIcon(ctx, action.id, icons) ?? null
  const label = action.label(ctx)

  if (variant === 'inline') {
    btn.className = 'media-toolbar__button' + (active ? ' media-toolbar__button--active' : '')
    btn.innerHTML = iconMarkup ?? `<span>${label}</span>`
    if (!iconMarkup) btn.classList.add('media-toolbar__button--text')
    btn.setAttribute('aria-label', label)
    // Icon-only buttons get the floating tooltip; text labels self-describe.
    if (iconMarkup) {
      const detach = attachTooltip(btn, label)
      tooltipDetaches?.push(detach)
    }
  } else {
    btn.className = 'media-toolbar__menu-item' + (active ? ' media-toolbar__menu-item--active' : '')
    btn.innerHTML = `${iconMarkup ?? ''}<span>${label}</span>`
  }
  return btn
}

export type OpenMediaPopoverOptions = {
  kind: string
  content: HTMLElement
  /** Click target — ignored for light-dismiss so toggle works. */
  trigger: HTMLElement
  /** Position surface; defaults to `trigger`. Overflow menus pass the toolbar bar. */
  positionReference?: HTMLElement
  variant?: 'menu' | 'dialog'
  role?: string
  ariaLabel?: string
  /** When false, skip toggle-close if the same kind is already open (dialogs). Default true for menu. */
  toggle?: boolean
}

/**
 * Media toolbar popover adapter — owns toggle, menu offset/shift, and dismiss-ignore.
 * Callers pass content + kind + anchors only.
 */
export function openMediaPopover(options: OpenMediaPopoverOptions): void {
  const {
    kind,
    content,
    trigger,
    positionReference = trigger,
    variant = 'menu',
    role,
    ariaLabel,
    toggle = variant === 'menu'
  } = options

  const controller = getDefaultController()
  if (toggle) {
    const state = controller.getState()
    if (state.kind === 'mounted' && state.popoverKind === kind) {
      controller.close()
      return
    }
  }

  const popover = createPopover({
    referenceElement: positionReference,
    content,
    ...POPOVER_BY_VARIANT[variant],
    role,
    ariaLabel,
    ignoreOutsideClickOn: trigger
  })

  controller.adopt(popover, kind, {
    element: popover.element,
    referenceElement: positionReference
  })
  popover.show()
}

export type OpenToolbarPopoverOptions = {
  /** Position against this surface; defaults to `trigger`. Overflow menus pass the toolbar bar. */
  positionReference?: HTMLElement
}

/** Toggle an anchored menu popover on the shared controller; one open at a time. */
export function openToolbarPopover(
  trigger: HTMLElement,
  body: HTMLElement,
  kind: string,
  options?: OpenToolbarPopoverOptions
): void {
  openMediaPopover({
    kind,
    content: body,
    trigger,
    positionReference: options?.positionReference,
    variant: 'menu'
  })
}

/** Close the popover opened by `openToolbarPopover` / `openMediaPopover`, if any. */
export function closeToolbarPopover(): void {
  getDefaultController().close()
}

/** Vertical overflow menu: action rows + inline-expanded submenu sections. */
export function buildOverflowMenu(
  ctx: MediaActionContext,
  menuActions: MediaAction[],
  icons?: MediaToolbarIconsResolver | null
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
    const row = actionButton(action, ctx, 'row', icons)
    row.onclick = () => action.run?.(ctx)
    menu.append(row)
  }
  return menu
}
