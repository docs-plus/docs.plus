/**
 * Table of contents — CSS class names (BEM-style `toc__*`).
 * Keep in sync with `styles/components/_tableOfContents.scss`.
 */
export const TOC_CLASSES = {
  list: 'toc__list',
  item: 'toc__item',
  link: 'toc__link',
  /** Left accent when row / title is active */
  activeBorder: 'toc__active-border',
  /** Editor scroll-spy focus on this TOC row */
  itemFocused: 'toc__item--focused',
  /** Nested list under a heading row */
  children: 'toc__children',
  /** Section expand/collapse control */
  foldBtn: 'toc__fold-btn',
  /** Opens chat for this heading (use with `data-heading-id`) */
  chatTrigger: 'toc__chat-trigger',
  /** Icon inside chat trigger */
  chatIcon: 'toc__chat-icon',
  /** H1–H6 badge (visible during drag) */
  levelBadge: 'toc__level-badge',
  /** Level picker popover next to drag handle */
  levelPicker: 'toc__level-picker'
} as const

export type TocClassName = (typeof TOC_CLASSES)[keyof typeof TOC_CLASSES]
