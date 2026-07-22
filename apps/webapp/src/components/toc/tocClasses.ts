/**
 * TOC class ownership map — the only product interface for TOC class strings.
 *
 * - Product (`toc__*`): listed here; SCSS in `_tableOfContents.scss`.
 * - Drag island (`toc-drag-handle`, overlays): listed here; SCSS in `_tocDrag.scss`.
 * - daisyUI (`.menu`, `menu-active`, `menu-focus`): vendor-owned — apply at call sites, not listed.
 */
export const TOC_CLASSES = {
  /** Desktop sticky first `<li>` wrapping the doc-title row inside `.menu`. */
  header: 'toc__header',
  /** Interactive `li > *` child — daisyUI menu item frame. */
  headerRow: 'toc__header-row',
  list: 'toc__list',
  /** daisyUI menu + product list shell (call sites add width/padding utilities). */
  listMenu: 'toc__list menu',
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
  /** Opens chat for this heading */
  chatTrigger: 'toc__chat-trigger',
  /** Icon inside chat trigger */
  chatIcon: 'toc__chat-icon',
  /** Chat open — theme-aware accent (SCSS → `--color-docsy`) */
  chatIconActive: 'toc__chat-icon--active',
  /** H1–H6 badge (visible during drag) */
  levelBadge: 'toc__level-badge',
  /** Level picker popover next to drag handle */
  levelPicker: 'toc__level-picker',
  /** Drag grip (always visible, inline shrink-0) */
  dragHandle: 'toc-drag-handle',
  /** Row context-menu open wash */
  contextMenuActive: 'context-menu-active'
} as const

export type TocClassName = (typeof TOC_CLASSES)[keyof typeof TOC_CLASSES]
