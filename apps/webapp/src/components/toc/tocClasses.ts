/**
 * TOC class ownership map, plus the one row lookup that uses it.
 * SCSS lives in `_tableOfContents.scss` (`toc__*`) and `_tocDrag.scss` (drag island).
 * daisyUI classes stay vendor-owned: apply them at call sites, never list them here.
 */
export const TOC_CLASSES = {
  /** Desktop sticky first `<li>` wrapping the doc-title row inside `.menu`. */
  header: 'toc__header',
  headerRow: 'toc__header-row',
  /** daisyUI menu + product list shell. `w-full p-0` lives here: a phone list once missed it. */
  listMenu: 'toc__list menu w-full p-0',
  item: 'toc__item',
  /** Leading, link, and trail are siblings (never nest buttons in `<a>`). */
  row: 'toc__row',
  rowLink: 'toc__row-link',
  link: 'toc__link',
  children: 'toc__children',
  /** DS-12: on the landing parent's child list while a drag targets a gap. */
  dropParent: 'is-drop-parent',
  /** On the row a drag will nest inside (drop onto a row). */
  dropTarget: 'is-drop-target',
  foldBtn: 'toc__fold-btn',
  chatTrigger: 'toc__chat-trigger',
  chatIcon: 'toc__chat-icon',
  /** Chat open — theme-aware accent (SCSS → `--color-docsy`), never `text-accent`. */
  chatIconActive: 'toc__chat-icon--active',
  levelBadge: 'toc__level-badge',
  /** Drag grip — desktop: row hover (+ focus-visible); mobile: always on. */
  dragHandle: 'toc-drag-handle',
  contextMenuActive: 'context-menu-active'
} as const

const rowSelector = `li.${TOC_CLASSES.item} > .${TOC_CLASSES.row}`

/** The heading row for `id`. Scope it to the TOC: rail ticks and editor headings share ids. */
export function tocRowElement(id: string, root: ParentNode): HTMLElement | null {
  return root.querySelector<HTMLElement>(
    `li.${TOC_CLASSES.item}[data-id="${CSS.escape(id)}"] > .${TOC_CLASSES.row}`
  )
}

/** Every heading row under `root`, by id, in one query. */
export function tocRowMap(root: ParentNode): Map<string, HTMLElement> {
  const map = new Map<string, HTMLElement>()
  root.querySelectorAll<HTMLElement>(rowSelector).forEach((el) => {
    const id = el.dataset.id
    if (id) map.set(id, el)
  })
  return map
}
