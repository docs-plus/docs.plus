/**
 * UniqueID `attributeName: 'toc-id'` stores under `toc-id`; the DOM attr is
 * `data-toc-id`. Do not read `node.attrs['data-toc-id']` or `node.attrs.id`.
 */
export function getTocId(attrs: Record<string, unknown>): string | undefined {
  const v = attrs['toc-id']
  return typeof v === 'string' ? v : undefined
}
