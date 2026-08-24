/**
 * TOC class ownership map — the only product interface for TOC class strings.
 * SCSS lives in `_tableOfContents.scss` (`toc__*`) and `_tocDrag.scss` (drag island).
 * daisyUI classes stay vendor-owned: apply them at call sites, never list them here.
 */
export const TOC_CLASSES = {
  /** Desktop sticky first `<li>` wrapping the doc-title row inside `.menu`. */
  header: 'toc__header',
  headerRow: 'toc__header-row',
  list: 'toc__list',
  /** daisyUI menu + product list shell (call sites add width/padding utilities). */
  listMenu: 'toc__list menu',
  item: 'toc__item',
  /** Leading, link, and trail are siblings (never nest buttons in `<a>`). */
  row: 'toc__row',
  rowLink: 'toc__row-link',
  link: 'toc__link',
  children: 'toc__children',
  foldBtn: 'toc__fold-btn',
  chatTrigger: 'toc__chat-trigger',
  chatIcon: 'toc__chat-icon',
  /** Chat open — theme-aware accent (SCSS → `--color-docsy`), never `text-accent`. */
  chatIconActive: 'toc__chat-icon--active',
  levelBadge: 'toc__level-badge',
  levelPicker: 'toc__level-picker',
  /** Drag grip — desktop: row hover (+ focus-visible); mobile: always on. */
  dragHandle: 'toc-drag-handle',
  contextMenuActive: 'context-menu-active'
} as const

export type TocClassName = (typeof TOC_CLASSES)[keyof typeof TOC_CLASSES]
