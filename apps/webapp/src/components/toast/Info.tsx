import { ToastNotification, ToastNotificationOptions } from './ToastNotification'

/**
 * Info toast - Colored indicator with info (blue) color.
 *
 * @example
 * toast.Info('New features available')
 * toast.Info(<><MdInfo /> Tip: Use keyboard shortcuts</>)
 */
export const Info = (
  content: React.ReactNode,
  options?: Partial<Omit<ToastNotificationOptions, 'variant'>>
) => {
  return ToastNotification(content, {
    ...options,
    variant: 'info'
  })
}
