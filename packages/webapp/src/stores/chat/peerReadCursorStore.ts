import { immer } from 'zustand/middleware/immer'

/** Per-channel peer last_read_seq high-watermark; seeded at bootstrap, advanced by read:advanced. */
export interface PeerReadCursorState {
  peerReadSeq: Map<string, number>
  setPeerReadSeq: (channelId: string, seq: number | null | undefined) => void
}

const peerReadCursorStore = immer<PeerReadCursorState>((set) => ({
  peerReadSeq: new Map(),
  setPeerReadSeq: (channelId, seq) =>
    set((state) => {
      if (seq == null) return
      const current = state.peerReadSeq.get(channelId) ?? 0
      if (seq <= current) return
      state.peerReadSeq.set(channelId, seq)
    })
}))

export default peerReadCursorStore
