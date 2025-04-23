import debounce from 'lodash/debounce'
import { useStore, useAuthStore, useChatStore } from '@stores'

// Enum to represent the different states of typing indicator.
export enum TypingIndicatorType {
  SentMsg = 'SentMsg',
  StartTyping = 'startTyping',
  StopTyping = 'stopTyping'
}

// Flag to track if typing has started.
let hasStartedTyping = false

const displayTypingIndicator = (type: TypingIndicatorType) => {
  const { broadcaster } = useStore.getState().settings
  const { headingId: channelId } = useChatStore.getState().chatRoom
  const profile = useAuthStore.getState().profile

  // Broadcasting typing indicator event.
  broadcaster
    ?.send({
      type: 'broadcast',
      event: 'typingIndicator',
      payload: {
        type,
        activeChannelId: channelId,
        user: {
          id: profile?.id,
          displayName: profile?.display_name
        }
      }
    })
    .then()
    .catch(console.error)
}

// Debounce function to limit the frequency of stop typing indicator broadcasts.
const debouncedStopTypingIndicator = debounce(() => {
  displayTypingIndicator(TypingIndicatorType.StopTyping)
  hasStartedTyping = false // Resetting typing start flag.
}, 1000) // Waiting for 1 second of inactivity before stopping the typing indicator.

// Main function to handle typing indicator based on the event type.
export const handleTypingIndicator = (type: TypingIndicatorType) => {
  if (type === TypingIndicatorType.StartTyping) {
    // When user starts typing.
    if (!hasStartedTyping) {
      displayTypingIndicator(type) // Display typing indicator.
      hasStartedTyping = true
    }
    debouncedStopTypingIndicator() // Debounce stopping the indicator.
  } else if (type === TypingIndicatorType.StopTyping) {
    // When user stops typing.
    debouncedStopTypingIndicator() // Debounce stopping the indicator.
  } else if (type === TypingIndicatorType.SentMsg) {
    // When user sends a message.
    debouncedStopTypingIndicator.cancel() // Cancel any pending debounced stop calls.
    displayTypingIndicator(TypingIndicatorType.StopTyping) // Immediately stop typing indicator.
    hasStartedTyping = false
  }
}
