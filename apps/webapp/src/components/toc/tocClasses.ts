/**
 * Table of contents — CSS class names (BEM-style `toc__*`).
 * Keep in sync with `styles/components/_tableOfContents.scss`.
 * Row active/spy use daisyUI `menu-active` / `menu-focus` (not listed here).
 */
export const TOC_CLASSES = {
  /** Desktop sticky first `<li>` wrapping the doc-title row inside `.menu`. */
  header: 'toc__header',
  /** Interactive `li > *` child — daisyUI menu item chrome. */
  headerRow: 'toc__header-row',
  list: 'toc__list',
  item: 'toc__item',
  /** Desktop row shell — leading, link, and trail are siblings (not nested buttons in `<a>`). */
  row: 'toc__row',
  /** Navigational title control inside `.toc__row`. */
  rowLink: 'toc__row-link',
  link: 'toc__link',
  /** Nested list under a heading row */
  children: 'toc__children',
  /** Section expand/collapse control */
  foldBtn: 'toc__fold-btn',
  /** Opens chat for this heading (use with `data-heading-id`) */
  chatTrigger: 'toc__chat-trigger',
  /** Icon inside chat trigger */
  chatIcon: 'toc__chat-icon',
  /** Chat open — theme-aware accent (SCSS → `--color-docsy`) */
  chatIconActive: 'toc__chat-icon--active',
  /** H1–H6 badge (visible during drag) */
  levelBadge: 'toc__level-badge',
  /** Level picker popover next to drag handle */
  levelPicker: 'toc__level-picker'
} as const

export type TocClassName = (typeof TOC_CLASSES)[keyof typeof TOC_CLASSES]
