import { type IconName, Icons } from '@icons'
import React from 'react'

/**
 * Legacy key → registry key mapping.
 *
 * Existing consumers (e.g. chatroom toolbar buttons) use string-based keys
 * like `<Icon type="Bold" />`. This map translates those legacy keys to the
 * canonical `Icons` registry names so everything resolves through a single
 * source of truth.
 */
const LEGACY_KEYS: Record<string, IconName> = {
  Bold: 'bold',
  Italic: 'italic',
  Underline: 'underline',
  Stric: 'strikethrough',
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
  /** Legacy string key or canonical registry name */
  type: string
  fill?: string
  size?: number
  className?: string
}

/**
 * Icon component — thin wrapper around the centralized `Icons` registry.
 *
 * Prefer using `Icons.xxx` directly in new code. This component exists
 * for backwards compatibility with string-based `<Icon type="Bold" />` usage.
 *
 * IMPORTANT: Never pass `fill={undefined}` to react-icons — it overrides their
 * built-in `fill="currentColor"`, stripping the attribute so the SVG falls
 * back to the spec default: black.
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
