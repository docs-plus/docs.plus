import {
  Bold,
  BulletList,
  CheckList,
  ClearMark,
  Filter,
  Gear,
  HighlightMarker,
  ImageBox,
  Italic,
  Link,
  OrderList,
  Printer,
  Redo,
  Stric,
  Underline,
  Undo
} from '@icons'
import React from 'react'
import { IoSend } from 'react-icons/io5'
import {
  MdClose as Close,
  MdCode,
  MdFormatColorText,
  MdOutlineAdd,
  MdOutlineEmojiEmotions
} from 'react-icons/md'
import { RiAtLine, RiCodeBlock } from 'react-icons/ri'
import { TbBlockquote } from 'react-icons/tb'

const icons: {
  [key: string]: React.ComponentType<{ size?: number; fill?: string; className?: any }>
} = {
  Bold,
  Italic,
  Underline,
  OrderList,
  BulletList,
  Link,
  CheckList,
  ImageBox,
  Gear,
  ClearMark,
  Stric,
  HighlightMarker,
  Undo,
  Redo,
  Printer,
  Filter,
  MdCode,
  RiCodeBlock,
  MdFormatColorText,
  MdOutlineEmojiEmotions,
  RiAtLine,
  IoSend,
  TbBlockquote,
  Close,
  MdOutlineAdd
}

type TIcon = {
  type: string
  fill?: string
  size: number
  className?: string
}

/**
 * Icon component for toolbar buttons
 * Uses theme-aware color by default (text-base-content/70)
 */
const Icon = ({ type, fill, size = 16, className = 'text-base-content/70' }: TIcon) => {
  const IconComponent = icons[type]
  // If fill is explicitly provided, use it; otherwise rely on className for color
  return <IconComponent fill={fill} size={size} className={!fill ? className : undefined} />
}

export default Icon
