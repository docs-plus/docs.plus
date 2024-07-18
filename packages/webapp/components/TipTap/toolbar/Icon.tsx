import React from 'react'
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
  Filter
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
