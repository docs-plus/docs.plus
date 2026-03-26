/**
 * Safely extract the TOC ID from ProseMirror node attributes.
 *
 * UniqueID with `attributeName: 'toc-id'` stores the value under the
 * PM schema key `toc-id`. The DOM attribute is `data-toc-id` (ProseMirror
 * prepends `data-` automatically). Use this helper instead of raw
 * `node.attrs['data-toc-id']` or `node.attrs.id`.
 */
export function getTocId(attrs: Record<string, unknown>): string | undefined {
  const v = attrs['toc-id']
  return typeof v === 'string' ? v : undefined
}
