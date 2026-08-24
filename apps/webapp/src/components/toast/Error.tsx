import { ToastNotification, ToastNotificationOptions } from './ToastNotification'

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
