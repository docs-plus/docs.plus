import SendMessage from './send-message/SendMessage'
import JoinBroadcastChannel from './JoinBroadcastChannel'
import JoinGroupChannel from './JoinGroupChannel'
import { useStore } from '@stores'

export const ChannelActionBar = () => {
  // const { isUserChannelMember, isUserChannelOwner, isUserChannelAdmin, channelInfo } = useStore(
  //   (state: any) => state.workspaceSettings
  // )

  return <SendMessage />

  // // For DIRECT, PRIVATE and default cases
  // if (['DIRECT', 'PRIVATE'].includes(channelInfo?.type) || !channelInfo?.type) {
  //   return <SendMessage />
  // }

  // // Specific logic for BROADCAST
  // if (channelInfo?.type === 'BROADCAST') {
  //   if (isUserChannelOwner || isUserChannelAdmin) {
  //     return <SendMessage />
  //   }
  //   return isUserChannelMember ? <JoinBroadcastChannel /> : <JoinGroupChannel />
  // }

  // // For GROUP and PUBLIC cases
  // if (['GROUP', 'PUBLIC'].includes(channelInfo?.type)) {
  //   return isUserChannelMember ? <SendMessage /> : <JoinGroupChannel />
  // }

  // // For ARCHIVE
  // if (channelInfo?.type === 'ARCHIVE') {
  //   return ''
  // }
}
