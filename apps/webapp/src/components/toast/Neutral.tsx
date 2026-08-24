import { ToastNotification, ToastNotificationOptions } from './ToastNotification'

export const Neutral = (
  content: React.ReactNode,
  options?: Partial<Omit<ToastNotificationOptions, 'variant'>>
) => {
  return ToastNotification(content, {
    ...options,
    variant: 'neutral'
  })
}
