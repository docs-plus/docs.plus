// Spreadsheet apps execute a cell whose text starts with = + - @ (or a
// leading tab/CR) as a formula. User-controlled fields (username, last_error…)
// reach an admin's Excel/Sheets on export, so neutralize the leading char.
function neutralizeCsvFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

export function exportToCSV<T extends object>(
  data: T[],
  filename: string,
  columns?: { key: keyof T | string; header: string }[]
): void {
  if (data.length === 0) return

  const cols =
    columns ||
    Object.keys(data[0]).map((key) => ({
      key: key,
      header: key
    }))

  const header = cols.map((col) => `"${col.header}"`).join(',')

  const rows = data.map((item) =>
    cols
      .map((col) => {
        const value = (item as Record<string, unknown>)[col.key as string]
        if (value === null || value === undefined) return '""'
        if (typeof value === 'string') return `"${neutralizeCsvFormula(value).replace(/"/g, '""')}"`
        if (value instanceof Date) return `"${value.toISOString()}"`
        return `"${String(value)}"`
      })
      .join(',')
  )

  const csv = [header, ...rows].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
