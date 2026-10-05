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
  // Only toggle-semantics actions (those declaring isActive) announce a state.
  const state = action.isActive ? String(active) : null
  const iconMarkup = action.icon?.(ctx) ?? resolveMediaToolbarIcon(ctx, action.id, icons) ?? null
  const label = action.label(ctx)

  // A label can carry a document-controlled attribute (the margin action reports
  // a non-preset value verbatim), so it is written as text, never interpolated.
  const labelSpan = (): HTMLSpanElement => {
    const span = document.createElement('span')
    span.textContent = label
    return span
  }

  if (variant === 'inline') {
    btn.className = 'media-toolbar__button' + (active ? ' media-toolbar__button--active' : '')
    if (state) btn.setAttribute('aria-pressed', state)
    if (iconMarkup) btn.innerHTML = iconMarkup
    else {
      btn.append(labelSpan())
      btn.classList.add('media-toolbar__button--text')
    }
    btn.setAttribute('aria-label', label)
    // Icon-only buttons get the floating tooltip; text labels self-describe.
    if (iconMarkup) {
      const detach = attachTooltip(btn, label)
      tooltipDetaches?.push(detach)
    }
  } else {
    btn.className = 'media-toolbar__menu-item' + (active ? ' media-toolbar__menu-item--active' : '')
    btn.setAttribute('role', state ? 'menuitemcheckbox' : 'menuitem')
    if (state) btn.setAttribute('aria-checked', state)
    if (iconMarkup) btn.innerHTML = iconMarkup
    btn.append(labelSpan())
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
  /** Runs when the popover hides or another popover replaces it, such as to reset `aria-expanded`. */
  onHide?: () => void
}

export function openMediaPopover(options: OpenMediaPopoverOptions): void {
  const {
    kind,
    content,
    trigger,
    positionReference = trigger,
    variant = 'menu',
    role,
    ariaLabel,
    toggle = variant === 'menu',
    onHide
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
    ignoreOutsideClickOn: trigger,
    onHide
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

let groupHeadingId = 0

/** A `role="group"` named by its visible heading, so each set of rows announces apart. */
export function labelledGroup(
  className: string,
  headingClassName: string,
  title: string,
  children: HTMLElement[]
): HTMLElement {
  const group = document.createElement('div')
  group.className = className
  group.setAttribute('role', 'group')
  const heading = document.createElement('p')
  heading.className = headingClassName
  heading.id = `hm-group-heading-${++groupHeadingId}`
  heading.textContent = title
  group.setAttribute('aria-labelledby', heading.id)
  group.append(heading, ...children)
  return group
}

// Host icons can carry an SVG <title>, so typeahead reads the row text without its icons.
function rowLabel(row: HTMLElement): string {
  const copy = row.cloneNode(true) as HTMLElement
  copy.querySelectorAll('svg').forEach((svg) => svg.remove())
  return copy.textContent?.trim().toLowerCase() ?? ''
}

/** Arrows, Home/End, first-letter typeahead and focus return to ⋯, as a native menu. */
function bindMenuKeys(menu: HTMLElement, trigger: HTMLElement): void {
  // A keyboard pick closes the menu, so focus goes back to ⋯ first. A dialog the row opens
  // can still take focus after this.
  menu.addEventListener(
    'click',
    (event) => {
      if (event.detail === 0) trigger.focus()
    },
    true
  )
  menu.addEventListener('keydown', (event) => {
    // The engine's root listener still hides the menu after focus returns to ⋯.
    if (event.key === 'Escape') {
      trigger.focus()
      return
    }
    const rows = Array.from(
      menu.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)')
    )
    const current = rows.indexOf(document.activeElement as HTMLButtonElement)
    let next: number
    if (event.key === 'ArrowDown') next = (current + 1) % rows.length
    else if (event.key === 'ArrowUp') next = current < 1 ? rows.length - 1 : current - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = rows.length - 1
    else if (
      event.key.length === 1 &&
      event.key !== ' ' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      const key = event.key.toLowerCase()
      const ordered = [...rows.slice(current + 1), ...rows.slice(0, current + 1)]
      const match = ordered.find((row) => rowLabel(row).startsWith(key))
      if (!match) return
      next = rows.indexOf(match)
    } else return
    event.preventDefault()
    rows[next]?.focus()
  })
}

/** Vertical overflow menu: action rows + inline-expanded submenu sections. */
export function buildOverflowMenu(
  ctx: MediaActionContext,
  menuActions: MediaAction[],
  trigger: HTMLElement,
  icons?: MediaToolbarIconsResolver | null
): HTMLElement {
  const menu = document.createElement('div')
  menu.className = 'media-toolbar__menu'
  menu.setAttribute('role', 'menu')
  menu.setAttribute('aria-label', 'More actions')
  const endsInDivider = () =>
    menu.lastElementChild?.classList.contains('media-toolbar__menu-divider') ?? false
  const appendDivider = () => {
    if (!menu.lastElementChild || endsInDivider()) return
    const divider = document.createElement('div')
    divider.className = 'media-toolbar__menu-divider'
    divider.setAttribute('role', 'separator')
    menu.append(divider)
  }
  for (const action of menuActions) {
    // The divider and the danger ink key on the id `delete`, not on the row's place.
    if (action.id === 'delete') appendDivider()
    if (action.renderSubmenu) {
      const submenu = action.renderSubmenu(ctx)
      // Submenu rows can be host markup. Inside the menu, a pressed row is a single-choice option.
      submenu.querySelectorAll('button:not([role])').forEach((row) => {
        const pressed = row.getAttribute('aria-pressed')
        row.setAttribute('role', pressed ? 'menuitemradio' : 'menuitem')
        if (!pressed) return
        row.setAttribute('aria-checked', pressed)
        row.removeAttribute('aria-pressed')
      })
      menu.append(
        labelledGroup(
          'media-toolbar__menu-section',
          'media-toolbar__menu-heading',
          action.label(ctx),
          [submenu]
        )
      )
    } else {
      const row = actionButton(action, ctx, 'row', icons)
      row.onclick = () => action.run?.(ctx)
      menu.append(row)
    }
    if (action.dividerAfter) appendDivider()
  }
  if (endsInDivider()) menu.lastElementChild?.remove()
  // Rows leave the Tab order; the arrow keys move between them, as in a native menu.
  menu.querySelectorAll<HTMLElement>('[role^="menuitem"]').forEach((row) => (row.tabIndex = -1))
  bindMenuKeys(menu, trigger)
  return menu
}
