/**
 * Toast Notification System
 * =========================
 * Theme-aware toasts with colored indicator bars.
 *
 * Design:
 * - Light theme: Dark background with white text
 * - Dark theme: Light background with dark text
 * - Colored vertical indicator bar on left
 * - Fully dynamic content (text, icons, or any React node)
 *
 * @example
 * import * as toast from '@components/toast'
 *
 * // Simple text
 * toast.Success('Document saved')
 * toast.Error('Failed to save')
 * toast.Info('New features available')
 * toast.Warning('Unsaved changes')
 * toast.Neutral('Message')
 *
 * // With icons
 * toast.Success(<><MdCheck /> Saved successfully</>)
 *
 * // With action button
 * toast.Error('Item deleted', { actionLabel: 'Undo', onAction: restore })
 *
 * // Loading (persistent)
 * const id = toast.Loading('Processing...')
 * toast.dismiss(id)
 *
 * // Replace loading with result
 * toast.Success('Done!', { id })
 */

export { Error } from './Error'
export { Info } from './Info'
export { dismiss, dismissAll,Loading } from './Loading'
export { Neutral } from './Neutral'
export { Success } from './Success'
export { ToastNotification } from './ToastNotification'
export { Warning } from './Warning'

// Alias: Danger = Error
export { Error as Danger } from './Error'

// Types
export type { LoadingToastOptions } from './Loading'
export type { ToastNotificationOptions, ToastVariant } from './ToastNotification'
