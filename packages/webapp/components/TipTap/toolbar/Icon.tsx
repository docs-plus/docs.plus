import React from 'react'
import { MdCode, MdFormatColorText, MdOutlineEmojiEmotions, MdOutlineAdd } from 'react-icons/md'
import { RiAtLine, RiCodeBlock } from 'react-icons/ri'
import { IoSend, IoCloseOutline as Close } from 'react-icons/io5'
import {
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
  Filter
} from '@icons'
import { TbBlockquote } from 'react-icons/tb'

const icons: { [key: string]: React.ComponentType<{ size?: number; fill?: string }> } = {
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
}

const Icon = ({ type, fill = 'rgba(0,0,0,.7)', size = 16 }: TIcon) => {
  const IconComponent = icons[type]
  return <IconComponent fill={fill} size={size} />
}

export default Icon
