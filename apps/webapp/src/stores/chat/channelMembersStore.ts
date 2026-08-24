import { immer } from 'zustand/middleware/immer'

export interface ChannelMembersState {
  channelMembers: Map<string, Map<string, any>>
  addChannelMember: (channelId: string, member: any) => void
}

const ChannelMembersStore = immer<ChannelMembersState>((set) => ({
  channelMembers: new Map(),

  addChannelMember: (channelId, member) =>
    set((state) => {
      const channelMembers = state.channelMembers.get(channelId) || new Map()
      channelMembers.set(member.id, member)
      state.channelMembers.set(channelId, channelMembers)
    })
}))

export default ChannelMembersStore
