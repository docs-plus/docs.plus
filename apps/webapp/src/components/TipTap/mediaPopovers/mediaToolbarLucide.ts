import {
  type MediaPlacementId,
  type MediaToolbarIconKey,
  type MediaToolbarIconsResolver
} from '@docs.plus/extension-hypermultimedia'
import { lucideSvgString } from '@utils/lucideSvgString'
import type { IconType } from 'react-icons'
import {
  LuAlignCenter,
  LuAlignLeft,
  LuAlignRight,
  LuCaptions,
  LuCopy,
  LuDownload,
  LuEllipsisVertical,
  LuExternalLink,
  LuMessageSquarePlus,
  LuPanelLeft,
  LuPanelRight,
  LuReplace,
  LuTrash2
} from 'react-icons/lu'

const PLACEMENT_ICONS: Record<MediaPlacementId, IconType> = {
  inline: LuAlignLeft,
  center: LuAlignCenter,
  right: LuAlignRight,
  'float-left': LuPanelLeft,
  'float-right': LuPanelRight
}

const ALIGN_PREFIX = 'align:'

const ACTION_ICONS: Partial<Record<MediaToolbarIconKey, IconType>> = {
  caption: LuCaptions,
  'view-original': LuExternalLink,
  download: LuDownload,
  replace: LuReplace,
  copy: LuCopy,
  delete: LuTrash2,
  more: LuEllipsisVertical,
  comment: LuMessageSquarePlus
}

export function createLucideToolbarIcons(): MediaToolbarIconsResolver {
  return ({ key }) => {
    const Icon = key.startsWith(ALIGN_PREFIX)
      ? PLACEMENT_ICONS[key.slice(ALIGN_PREFIX.length) as MediaPlacementId]
      : ACTION_ICONS[key]
    return Icon ? lucideSvgString(Icon) : undefined
  }
}
