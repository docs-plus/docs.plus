/**
 * Icon barrel export.
 *
 * - Icons: centralized icon registry (single source of truth for all UI icons)
 * - DocsPlusIcon: brand logo (gradients, brand colors — no standard equivalent)
 * - ProseMirror string-template icons (DOM-injected, outside React tree)
 *
 * All toolbar/UI icons MUST go through the `Icons` registry.
 * To swap an icon, change only `registry.ts` — every consumer updates automatically.
 */

export { DocsPlusIcon } from './DocsPlusIcon'
export { AddCommentSVG, ChatLeftSVG } from './prosemirror-icons'
export type { IconName } from './registry'
export { Icons } from './registry'
