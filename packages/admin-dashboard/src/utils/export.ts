/**
 * Export data to CSV and trigger download
 */
export function exportToCSV<T extends object>(
  data: T[],
  filename: string,
  columns?: { key: keyof T | string; header: string }[]
): void {
  if (data.length === 0) return;

  // Determine columns from first item if not provided
  const cols = columns || Object.keys(data[0]).map((key) => ({
    key: key,
    header: key,
  }));

  // Build CSV header
  const header = cols.map((col) => `"${col.header}"`).join(',');

  // Build CSV rows
  const rows = data.map((item) =>
    cols
      .map((col) => {
        const value = (item as Record<string, unknown>)[col.key as string];
        if (value === null || value === undefined) return '""';
        if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
        if (value instanceof Date) return `"${value.toISOString()}"`;
        return `"${String(value)}"`;
      })
      .join(',')
  );

  // Combine header and rows
  const csv = [header, ...rows].join('\n');

  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format a date for CSV export
 */
export function formatDateForExport(date: string | Date): string {
  return new Date(date).toISOString().split('T')[0];
}
