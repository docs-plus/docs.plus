import { ToastNotification, ToastNotificationOptions } from './ToastNotification'

export const Info = (
  content: React.ReactNode,
  options?: Partial<Omit<ToastNotificationOptions, 'variant'>>
) => {
  return ToastNotification(content, {
    ...options,
    variant: 'info'
  })
}
