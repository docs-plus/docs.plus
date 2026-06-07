import { useChatStore } from '@stores'

export const usePeerReadSeq = (channelId: string): number =>
  useChatStore((s) => s.peerReadSeq.get(channelId) ?? 0)
