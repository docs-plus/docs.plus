/** Display count capped at max (e.g. 100 → "99+"). */
export function formatCappedCount(count: number, max = 99): string {
  return count > max ? `${max}+` : String(count)
}
