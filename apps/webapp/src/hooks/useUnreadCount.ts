import { useChatStore } from '@stores'
import { resolveUnreadCount } from '@utils/unreadDisplay'

export function useUnreadCount(channelId: string): number {
  return useChatStore((state) => resolveUnreadCount(channelId, state))
}
