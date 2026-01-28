import { ToastNotification, ToastNotificationOptions } from './ToastNotification'

/**
 * Warning toast - Colored indicator with warning (orange) color.
 *
 * @example
 * toast.Warning('Unsaved changes will be lost')
 * toast.Warning('Session expiring', { actionLabel: 'Extend', onAction: handleExtend })
 */
export const Warning = (
  content: React.ReactNode,
  options?: Partial<Omit<ToastNotificationOptions, 'variant'>>
) => {
  return ToastNotification(content, {
    duration: 5000, // Warnings stay longer
    ...options,
    variant: 'warning'
  })
}
