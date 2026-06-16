/**
 * Table of contents — CSS class names (BEM-style `toc__*`).
 * Keep in sync with `styles/components/_tableOfContents.scss`.
 */
export const TOC_CLASSES = {
  /** Doc title row in TocHeader — paired with `.toc__active-border` for gutter-safe accent */
  headerRow: 'toc__header-row',
  list: 'toc__list',
  item: 'toc__item',
  /** Desktop row shell — drag handle, link, and chat sit as siblings (not nested buttons in `<a>`). */
  row: 'toc__row',
  /** Navigational title control inside `.toc__row`. */
  rowLink: 'toc__row-link',
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
  /** Chat open for this row — theme-aware accent (pairs with SCSS `.toc__row.active .toc__chat-icon--active`) */
  chatIconActive: 'toc__chat-icon--active',
  /** H1–H6 badge (visible during drag) */
  levelBadge: 'toc__level-badge',
  /** Level picker popover next to drag handle */
  levelPicker: 'toc__level-picker'
} as const

export type TocClassName = (typeof TOC_CLASSES)[keyof typeof TOC_CLASSES]
