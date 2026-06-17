import {
  resolveXEmbedSizeId,
  X_EMBED_SIZE_OPTIONS,
  X_EMBED_THEME_OPTIONS,
  type XEmbedTheme
} from '../nodes/x/embedOptions'
import { applyNodeAttributes } from '../utils/media-node-attrs'
import {
  getCurrentMediaPlacement,
  getMediaPlacementAttrs,
  MEDIA_MARGIN_OPTIONS,
  MEDIA_PLACEMENT_OPTIONS
} from '../utils/media-placement'
import type { MediaActionsBuilder } from './compose'
import {
  canViewOriginal,
  copyMediaNode,
  downloadMedia,
  focusCaption,
  isDownloadable,
  removeMediaNode,
  viewOriginalMedia
} from './handlers'
import { openReplaceUrlPopover } from './replaceUrl'
import { resolveMediaToolbarIcon } from './resolveIcon'
import type { MediaAction, MediaActionContext, MediaActionList } from './types'

const DEFAULT_WRAP_MARGIN = '0.5in'

const isPresetMargin = (value: string): boolean =>
  MEDIA_MARGIN_OPTIONS.some((option) => option.value === value)

function submenuItem(active: boolean): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className =
    'media-toolbar__submenu-item' + (active ? ' media-toolbar__submenu-item--active' : '')
  btn.setAttribute('aria-pressed', active ? 'true' : 'false')
  return btn
}

function textItem(label: string, active: boolean, onClick: () => void): HTMLButtonElement {
  const btn = submenuItem(active)
  btn.textContent = label
  btn.onclick = onClick
  return btn
}

function renderAlignmentSubmenu(ctx: MediaActionContext): HTMLElement {
  const list = document.createElement('div')
  list.className = 'media-toolbar__submenu'
  const current = getCurrentMediaPlacement(ctx.attrs)
  // Non-preset margins ('auto' from center, '0' from inline) would collapse the wrap gap.
  const rawMargin = String(ctx.attrs.margin ?? '')
  const margin = isPresetMargin(rawMargin) ? rawMargin : DEFAULT_WRAP_MARGIN
  for (const { id, label } of MEDIA_PLACEMENT_OPTIONS) {
    const btn = submenuItem(current === id)
    btn.innerHTML = `${resolveMediaToolbarIcon(ctx, `align:${id}`) ?? ''}<span>${label}</span>`
    btn.onclick = () => {
      applyNodeAttributes(ctx.editor, ctx.nodePos, getMediaPlacementAttrs(id, margin))
      ctx.close()
    }
    list.append(btn)
  }
  return list
}

/** Margin only matters when text wraps around the media, so the control is float-only. */
function isWrapPlacement(attrs: Record<string, unknown>): boolean {
  const placement = getCurrentMediaPlacement(attrs)
  return placement === 'float-left' || placement === 'float-right'
}

function currentMargin(attrs: Record<string, unknown>): string {
  return String(attrs.margin ?? DEFAULT_WRAP_MARGIN)
}

function marginLabel(ctx: MediaActionContext): string {
  const current = currentMargin(ctx.attrs)
  return MEDIA_MARGIN_OPTIONS.find((option) => option.value === current)?.label ?? current
}

/** Preset gaps for wrap placements; a legacy non-preset margin surfaces as the active extra row. */
function renderMarginSubmenu(ctx: MediaActionContext): HTMLElement {
  const list = document.createElement('div')
  list.className = 'media-toolbar__submenu'
  const current = currentMargin(ctx.attrs)
  const apply = (value: string) => {
    applyNodeAttributes(
      ctx.editor,
      ctx.nodePos,
      getMediaPlacementAttrs(getCurrentMediaPlacement(ctx.attrs), value)
    )
    ctx.close()
  }
  const marginItem = (value: string, label: string) =>
    list.append(textItem(label, current === value, () => apply(value)))
  for (const { value, label } of MEDIA_MARGIN_OPTIONS) marginItem(value, label)
  if (!isPresetMargin(current)) marginItem(current, current)
  return list
}

function renderXOptionsSubmenu(ctx: MediaActionContext): HTMLElement {
  const list = document.createElement('div')
  list.className = 'media-toolbar__submenu'
  const activeSize = resolveXEmbedSizeId(ctx.attrs.maxwidth as number | null | undefined)
  const activeTheme = (ctx.attrs.theme as XEmbedTheme | undefined) ?? 'light'

  const section = (title: string, children: HTMLElement[]) => {
    const wrap = document.createElement('div')
    wrap.className = 'media-toolbar__submenu-section'
    const heading = document.createElement('p')
    heading.className = 'media-toolbar__submenu-heading'
    heading.textContent = title
    wrap.append(heading, ...children)
    return wrap
  }
  list.append(
    section(
      'Size',
      X_EMBED_SIZE_OPTIONS.map(({ id, label, maxwidth }) =>
        textItem(label, activeSize === id, () => {
          applyNodeAttributes(ctx.editor, ctx.nodePos, { maxwidth })
          ctx.close()
        })
      )
    ),
    section(
      'Theme',
      X_EMBED_THEME_OPTIONS.map(({ id, label }) =>
        textItem(label, activeTheme === id, () => {
          applyNodeAttributes(ctx.editor, ctx.nodePos, { theme: id })
          ctx.close()
        })
      )
    )
  )
  return list
}

/** Authored in display order — array position is the source of truth (no numeric `order`). */
export const BASE_ACTIONS: MediaActionList = [
  {
    id: 'align',
    label: () => 'Align',
    placement: 'inline',
    renderSubmenu: renderAlignmentSubmenu
  },
  {
    id: 'margin',
    label: marginLabel,
    placement: 'inline',
    isVisible: (ctx) => isWrapPlacement(ctx.attrs),
    renderSubmenu: renderMarginSubmenu,
    dividerAfter: true
  },
  {
    id: 'caption',
    label: () => 'Caption',
    placement: 'inline',
    run: focusCaption
  },
  {
    id: 'view-original',
    label: () => 'View original',
    placement: 'inline',
    isVisible: canViewOriginal,
    run: viewOriginalMedia
  },
  {
    id: 'download',
    label: () => 'Download',
    placement: 'inline',
    isVisible: (ctx) => isDownloadable(ctx.nodeType) && Boolean(ctx.attrs.src),
    run: (ctx) => void downloadMedia(ctx)
  },
  {
    id: 'replace',
    label: () => 'Replace URL',
    placement: 'overflow',
    isVisible: (ctx) => Boolean(ctx.attrs.src),
    run: openReplaceUrlPopover
  },
  {
    id: 'copy',
    label: () => 'Copy',
    placement: 'overflow',
    run: (ctx) => void copyMediaNode(ctx)
  },
  {
    id: 'delete',
    label: () => 'Delete',
    placement: 'overflow',
    run: removeMediaNode
  }
]

const X_OPTIONS_ACTION: MediaAction = {
  id: 'x-options',
  label: () => 'Post options',
  placement: 'overflow',
  renderSubmenu: renderXOptionsSubmenu
}

/** Per-node recipes snap extra bricks onto the base set via the builder (replaces the old `order` interleave). */
export const NODE_ACTION_RECIPES: Record<
  string,
  (builder: MediaActionsBuilder) => MediaActionsBuilder
> = {
  x: (builder) => builder.add(X_OPTIONS_ACTION, { after: 'replace' })
}
