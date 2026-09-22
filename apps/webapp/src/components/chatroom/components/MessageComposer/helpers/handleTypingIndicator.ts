import { useAuthStore, useStore } from '@stores'
import type { PresenceActivity, TypingIndicatorPayload } from '@types'
import debounce from 'lodash/debounce'

export enum TypingIndicatorType {
  SentMsg = 'SentMsg',
  StartTyping = 'startTyping',
  StopTyping = 'stopTyping'
}

// A quicker open and close sends nothing.
const ACTIVITY_START_DELAY_MS = 300
// Peers expire an activity 8 s after its last start (useBroadcastListener).
// A presence sync also drops it, so the resend brings the chip back.
const ACTIVITY_KEEPALIVE_MS = 3000

let hasStartedTyping = false

let currentActivity: PresenceActivity | null = null
let activityStartSent = false
let activityStartTimer: ReturnType<typeof setTimeout> | undefined
let activityKeepalive: ReturnType<typeof setInterval> | undefined

const sendTypingIndicator = (type: TypingIndicatorPayload['type'], activity?: PresenceActivity) => {
  const { broadcaster } = useStore.getState().settings
  const profile = useAuthStore.getState().profile
  if (!profile) return

  const payload: TypingIndicatorPayload = {
    type,
    activity,
    user: { id: profile.id }
  }

  broadcaster
    ?.send({
      type: 'broadcast',
      event: 'typingIndicator',
      payload
    })
    .then()
    .catch(console.error)
}

const debouncedStopTypingIndicator = debounce(() => {
  sendTypingIndicator('stopTyping')
  hasStartedTyping = false
}, 1000)

export const handleTypingIndicator = (type: TypingIndicatorType) => {
  if (type === TypingIndicatorType.StartTyping) {
    // An emoji insert fires onUpdate; it must not flash "typing" under the chip.
    if (currentActivity) return
    if (!hasStartedTyping) {
      sendTypingIndicator('startTyping')
      hasStartedTyping = true
    }
    debouncedStopTypingIndicator()
  } else if (type === TypingIndicatorType.StopTyping) {
    debouncedStopTypingIndicator()
  } else if (type === TypingIndicatorType.SentMsg) {
    debouncedStopTypingIndicator.cancel()
    sendTypingIndicator('stopTyping')
    hasStartedTyping = false
  }
}

export const stopComposerActivity = (activity: PresenceActivity) => {
  if (currentActivity !== activity) return
  currentActivity = null
  clearTimeout(activityStartTimer)
  clearInterval(activityKeepalive)
  if (activityStartSent) sendTypingIndicator('stopActivity', activity)
  activityStartSent = false
}

/** One activity per face, so a new start replaces the current one. */
export const startComposerActivity = (activity: PresenceActivity) => {
  if (currentActivity) stopComposerActivity(currentActivity)
  currentActivity = activity
  activityStartTimer = setTimeout(() => {
    debouncedStopTypingIndicator.cancel()
    if (hasStartedTyping) sendTypingIndicator('stopTyping')
    hasStartedTyping = false
    sendTypingIndicator('startActivity', activity)
    activityStartSent = true
    activityKeepalive = setInterval(() => {
      if (!document.hidden) sendTypingIndicator('startActivity', activity)
    }, ACTIVITY_KEEPALIVE_MS)
  }, ACTIVITY_START_DELAY_MS)
}
