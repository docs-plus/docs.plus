import {
  resolveXEmbedSizeId,
  X_EMBED_SIZE_OPTIONS,
  X_EMBED_THEME_OPTIONS,
  type XEmbedTheme
} from '../nodes/x/embedOptions'
import * as Icons from '../utils/icons'
import { applyNodeAttributes } from '../utils/media-node-attrs'
import {
  getCurrentMediaPlacement,
  getMediaPlacementAttrs,
  MEDIA_MARGIN_OPTIONS,
  MEDIA_PLACEMENT_OPTIONS,
  type MediaPlacementId
} from '../utils/media-placement'
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
import type { MediaActionContext, MediaActionList } from './types'

const ALIGN_ICON: Record<MediaPlacementId, keyof typeof Icons> = {
  inline: 'AlignLeft',
  center: 'AlignCenter',
  right: 'AlignRight',
  'float-left': 'ImageLeft',
  'float-right': 'ImageRight'
}

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
    btn.innerHTML = `${Icons[ALIGN_ICON[id]]({ size: 18 })}<span>${label}</span>`
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

export const BASE_ACTIONS: MediaActionList = [
  {
    id: 'caption',
    label: () => 'Caption',
    icon: () => Icons.Caption({ size: 18 }),
    placement: 'inline',
    order: 20,
    run: focusCaption
  },
  {
    id: 'align',
    label: () => 'Align',
    icon: (ctx) => Icons[ALIGN_ICON[getCurrentMediaPlacement(ctx.attrs)]]({ size: 18 }),
    placement: 'inline',
    order: 10,
    renderSubmenu: renderAlignmentSubmenu
  },
  {
    id: 'margin',
    label: marginLabel,
    placement: 'inline',
    order: 15,
    isVisible: (ctx) => isWrapPlacement(ctx.attrs),
    renderSubmenu: renderMarginSubmenu,
    dividerAfter: true
  },
  {
    id: 'view-original',
    label: () => 'View original',
    icon: () => Icons.ExternalLink({ size: 18 }),
    placement: 'inline',
    order: 30,
    isVisible: canViewOriginal,
    run: viewOriginalMedia
  },
  {
    id: 'download',
    label: () => 'Download',
    icon: () => Icons.Download({ size: 18 }),
    placement: 'inline',
    order: 40,
    isVisible: (ctx) => isDownloadable(ctx.nodeType) && Boolean(ctx.attrs.src),
    run: (ctx) => void downloadMedia(ctx)
  },
  {
    id: 'replace',
    label: () => 'Replace URL',
    icon: () => Icons.Replace({ size: 18 }),
    placement: 'overflow',
    order: 44,
    isVisible: (ctx) => Boolean(ctx.attrs.src),
    run: openReplaceUrlPopover
  },
  {
    id: 'copy',
    label: () => 'Copy',
    icon: () => Icons.Copy({ size: 18 }),
    placement: 'overflow',
    order: 50,
    run: (ctx) => void copyMediaNode(ctx)
  },
  {
    id: 'delete',
    label: () => 'Delete',
    icon: () => Icons.Trash({ size: 18 }),
    placement: 'overflow',
    order: 60,
    run: removeMediaNode
  }
]

/** Per-node extras merged after the base set. */
export const NODE_ACTIONS: Record<string, MediaActionList> = {
  x: [
    {
      id: 'x-options',
      label: () => 'Post options',
      placement: 'overflow',
      order: 45,
      renderSubmenu: renderXOptionsSubmenu
    }
  ]
}
