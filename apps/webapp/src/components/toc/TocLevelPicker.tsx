import { twMerge } from 'tailwind-merge'

import { TOC_CLASSES } from './tocClasses'

export const TOC_MAX_HEADING_LEVEL = 6
const LEVEL_PICKER_RADIUS = 3

export function levelPickerRange(level: number, maxLevel = TOC_MAX_HEADING_LEVEL) {
  const min = Math.max(1, level - LEVEL_PICKER_RADIUS)
  const max = Math.min(maxLevel, level + LEVEL_PICKER_RADIUS)
  return Array.from({ length: max - min + 1 }, (_, i) => min + i)
}

interface TocLevelPickerProps {
  level: number
  /** `preview` = decorative hover chip only; `drag` = overlay tracks projected level. */
  mode?: 'preview' | 'drag'
  /** Drag overlay — highlights the level the row would snap to. */
  projectedLevel?: number
  className?: string
}

export function TocLevelPicker({
  level,
  mode = 'drag',
  projectedLevel,
  className
}: TocLevelPickerProps) {
  const activeLevel = mode === 'preview' ? level : (projectedLevel ?? level)

  return (
    <div className={twMerge('toc-drag-levels', TOC_CLASSES.levelPicker, className)}>
      {levelPickerRange(level).map((n) => (
        <span
          key={n}
          className={twMerge(
            'toc-drag-level',
            n === activeLevel && 'active',
            n === level && 'original'
          )}>
          H{n}
        </span>
      ))}
    </div>
  )
}
