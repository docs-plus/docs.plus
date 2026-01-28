import { ToastNotification, ToastNotificationOptions } from './ToastNotification'

/**
 * Error/Danger toast - Colored indicator with error (red) color.
 * Commonly used with "Undo" action for destructive operations.
 *
 * @example
 * toast.Error('Failed to save')
 * toast.Error('Item deleted', { actionLabel: 'Undo', onAction: handleUndo })
 */
export const Error = (
  content: React.ReactNode,
  options?: Partial<Omit<ToastNotificationOptions, 'variant'>>
) => {
  return ToastNotification(content, {
    duration: 5000, // Errors stay longer
    ...options,
    variant: 'error'
  })
}
