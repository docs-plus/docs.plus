/** A stable 32-bit string hash (djb2). It keys per-source storage. */
export function hashSource(source: string): string {
  let hash = 5381
  for (let i = 0; i < source.length; i++) hash = ((hash << 5) + hash + source.charCodeAt(i)) | 0
  return (hash >>> 0).toString(36)
}
