import { ToastNotification, ToastNotificationOptions } from './ToastNotification'

/**
 * Success toast - Colored indicator with success (green) color.
 *
 * @example
 * toast.Success('Document saved')
 * toast.Success(<><MdCheck /> Saved successfully</>)
 * toast.Success('Item created', { actionLabel: 'View', onAction: handleView })
 */
export const Success = (
  content: React.ReactNode,
  options?: Partial<Omit<ToastNotificationOptions, 'variant'>>
) => {
  return ToastNotification(content, {
    ...options,
    variant: 'success'
  })
}
