import { TMessageWithUser } from '@api'
import { create } from 'zustand'

// TODO: this is not good enough, we need to create these for each channel, in order when user back to channel, has last state of replay or edit message
type TUseReplayOrForwardMessage = {
  replayToMessage: TMessageWithUser | null
  editeMessage: TMessageWithUser | null
}

const useReplayOrForwardMessage = create<TUseReplayOrForwardMessage>(() => ({
  replayToMessage: null,
  editeMessage: null
}))

export const useReplayMessageInfo = () => useReplayOrForwardMessage().replayToMessage
export const useEditeMessageInfo = () => useReplayOrForwardMessage().editeMessage

export const setReplayMessage = (
  replayToMessageId: TUseReplayOrForwardMessage['replayToMessage']
) => useReplayOrForwardMessage.setState({ replayToMessage: replayToMessageId })

export const setEditeMessage = (editeMessage: TUseReplayOrForwardMessage['editeMessage']) =>
  useReplayOrForwardMessage.setState({ editeMessage })
