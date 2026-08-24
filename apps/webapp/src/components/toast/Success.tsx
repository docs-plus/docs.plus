import { ToastNotification, ToastNotificationOptions } from './ToastNotification'

export const Success = (
  content: React.ReactNode,
  options?: Partial<Omit<ToastNotificationOptions, 'variant'>>
) => {
  return ToastNotification(content, {
    ...options,
    variant: 'success'
  })
}
