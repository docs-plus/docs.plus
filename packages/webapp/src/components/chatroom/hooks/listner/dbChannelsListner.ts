import { channelInsert, channelMessageCountsInsert,channelUpdate } from './helpers'

export const dbChannelsListner = (payload: any) => {
  if (payload.eventType === 'INSERT') {
    channelInsert(payload)
  }
  if (payload.eventType === 'UPDATE') {
    channelUpdate(payload)
  }
}

export const dbChannelMessageCountsListner = (payload: any) => {
  if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
    channelMessageCountsInsert(payload)
  }
}
