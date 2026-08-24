import { ToastNotification, ToastNotificationOptions } from './ToastNotification'

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
