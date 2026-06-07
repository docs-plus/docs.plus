import { format, formatDistanceToNow } from 'date-fns'

/**
 * Format a date for display
 */
export function formatDate(date: string | Date, pattern = 'MMM d, yyyy'): string {
  return format(new Date(date), pattern)
}

/**
 * Format a date with time
 */
export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy HH:mm')
}

/**
 * Format a time only
 */
export function formatTime(date: string | Date): string {
  return format(new Date(date), 'HH:mm:ss')
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

/**
 * Format a number with locale separators
 */
export function formatNumber(num: number): string {
  return num.toLocaleString()
}

/**
 * Format a percentage
 */
export function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((value / total) * 100)}%`
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}...`
}
