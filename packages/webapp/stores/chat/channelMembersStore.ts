import { immer } from 'zustand/middleware/immer'

// Define the state interface
export interface ChannelMembersState {
  channelMembers: Map<string, Map<string, any>>
  addChannelMember: (channelId: string, member: any) => void
  removeChannelMember: (channelId: string, memberId: string) => void
  clearChannelMembers: (channelId: string) => void
  bulkSetChannelMembers: (channelId: string, members: any[]) => void
}

// Implement the store with immer and support for channelId
const ChannelMembersStore = immer<ChannelMembersState>((set) => ({
  channelMembers: new Map(),

  addChannelMember: (channelId, member) =>
    set((state) => {
      const channelMembers = state.channelMembers.get(channelId) || new Map()
      channelMembers.set(member.id, member)
      state.channelMembers.set(channelId, channelMembers)
    }),

  removeChannelMember: (channelId, memberId) =>
    set((state) => {
      const channelMembers = state.channelMembers.get(channelId)
      if (channelMembers) {
        channelMembers.delete(memberId)
      }
    }),

  clearChannelMembers: (channelId) =>
    set((state) => {
      state.channelMembers.delete(channelId)
    }),

  bulkSetChannelMembers: (channelId, members) =>
    set((state) => {
      const channelMembers = state.channelMembers.get(channelId) || new Map()
      members.forEach((member) => channelMembers.set(member.id, member))
      state.channelMembers.set(channelId, channelMembers)
    })
}))

export default ChannelMembersStore
