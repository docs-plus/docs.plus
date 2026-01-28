import { ToastNotification, ToastNotificationOptions } from './ToastNotification'

/**
 * Neutral toast - No colored indicator, just content.
 *
 * @example
 * toast.Neutral('Message sent')
 * toast.Neutral(<><MdEmail /> Email sent</>)
 */
export const Neutral = (
  content: React.ReactNode,
  options?: Partial<Omit<ToastNotificationOptions, 'variant'>>
) => {
  return ToastNotification(content, {
    ...options,
    variant: 'neutral'
  })
}
