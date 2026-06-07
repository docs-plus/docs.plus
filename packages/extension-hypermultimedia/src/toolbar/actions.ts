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
import type { MediaActionContext, MediaActionList } from './types'

const ALIGN_ICON: Record<MediaPlacementId, keyof typeof Icons> = {
  inline: 'AlignLeft',
  center: 'AlignCenter',
  'float-left': 'ImageLeft',
  'float-right': 'ImageRight'
}

function submenuItem(active: boolean): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className =
    'media-toolbar__submenu-item' + (active ? ' media-toolbar__submenu-item--active' : '')
  return btn
}

function renderAlignmentSubmenu(ctx: MediaActionContext): HTMLElement {
  const list = document.createElement('div')
  list.className = 'media-toolbar__submenu'
  const current = getCurrentMediaPlacement(ctx.attrs)
  const margin = String(ctx.attrs.margin ?? '0.5in')
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
  const textButton = (label: string, active: boolean, onClick: () => void) => {
    const btn = submenuItem(active)
    btn.textContent = label
    btn.onclick = onClick
    return btn
  }

  list.append(
    section(
      'Size',
      X_EMBED_SIZE_OPTIONS.map(({ id, label, maxwidth }) =>
        textButton(label, activeSize === id, () => {
          applyNodeAttributes(ctx.editor, ctx.nodePos, { maxwidth })
          ctx.close()
        })
      )
    ),
    section(
      'Theme',
      X_EMBED_THEME_OPTIONS.map(({ id, label }) =>
        textButton(label, activeTheme === id, () => {
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
    order: 10,
    run: focusCaption
  },
  {
    id: 'align',
    label: () => 'Align',
    icon: (ctx) => Icons[ALIGN_ICON[getCurrentMediaPlacement(ctx.attrs)]]({ size: 18 }),
    placement: 'inline',
    order: 20,
    renderSubmenu: renderAlignmentSubmenu
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
    id: 'copy',
    label: () => 'Copy',
    icon: () => Icons.Copy({ size: 18 }),
    placement: 'menu',
    order: 50,
    run: (ctx) => void copyMediaNode(ctx)
  },
  {
    id: 'delete',
    label: () => 'Delete',
    icon: () => Icons.Trash({ size: 18 }),
    placement: 'menu',
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
      placement: 'menu',
      order: 45,
      renderSubmenu: renderXOptionsSubmenu
    }
  ]
}
