import { type IconName, Icons } from '@icons'
import React from 'react'

/**
 * Existing consumers (e.g. chatroom toolbar buttons) pass string keys like
 * `<Icon type="Bold" />`; this maps them onto the canonical `Icons` registry.
 */
const LEGACY_KEYS: Record<string, IconName> = {
  Bold: 'bold',
  Italic: 'italic',
  Underline: 'underline',
  Strike: 'strikethrough',
  HighlightMarker: 'highlight',
  ClearMark: 'clearFormatting',
  OrderList: 'orderedList',
  BulletList: 'bulletList',
  CheckList: 'taskList',
  Link: 'link',
  ImageBox: 'image',
  Undo: 'undo',
  Redo: 'redo',
  Printer: 'print',
  Filter: 'filter',
  Gear: 'settings',
  MdCode: 'code',
  RiCodeBlock: 'codeBlock',
  MdFormatColorText: 'textColor',
  MdOutlineEmojiEmotions: 'emoji',
  RiAtLine: 'mention',
  IoSend: 'send',
  TbBlockquote: 'blockquote',
  Close: 'close',
  MdOutlineAdd: 'plus'
}

interface IconProps {
  type: string
  fill?: string
  size?: number
  className?: string
}

/**
 * Prefer `Icons.xxx` directly in new code; this exists for the string-key call
 * sites. Never pass `fill={undefined}` to react-icons — it overrides their
 * built-in `fill="currentColor"` and the SVG falls back to the spec default,
 * black.
 */
const Icon = ({ type, fill, size = 16, className = 'text-base-content/70' }: IconProps) => {
  const registryKey = LEGACY_KEYS[type] ?? (type as IconName)
  const IconComponent = Icons[registryKey]

  if (!IconComponent) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[Icon] Unknown icon type: "${type}"`)
    }
    return null
  }

  if (fill) {
    return <IconComponent fill={fill} size={size} />
  }

  return <IconComponent size={size} className={className} />
}

export default Icon
