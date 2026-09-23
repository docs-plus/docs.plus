import type { VoiceNoteEffect, VoiceNoteEvent, VoiceNoteState } from '../types'

export const MIN_SEND_MS = 1000
export const CANCEL_THRESHOLD_PX = 80
const LOCK_THRESHOLD_PX = 80

export const VOICE_NOTE_IDLE: VoiceNoteState = {
  phase: 'idle',
  request: null,
  releasedEarly: false
}

type VoiceNoteStep = { state: VoiceNoteState; effects: VoiceNoteEffect[] }

const TEARDOWN: VoiceNoteEffect = { type: 'teardown' }
const HAPTIC: VoiceNoteEffect = { type: 'haptic' }
const HINT: VoiceNoteEffect = { type: 'hint' }
const STOP_RECORDER: VoiceNoteEffect = { type: 'stopRecorder' }
const DRAG_HOME: VoiceNoteEffect = { type: 'drag', x: 0, y: 0 }

const toIdle = (...effects: VoiceNoteEffect[]): VoiceNoteStep => ({
  state: VOICE_NOTE_IDLE,
  effects
})

// The phone hold-only ruling lives in the release rows. A release under 1 s,
// or before the microphone answers, shows the hint and never sends.
export function stepVoiceNote(state: VoiceNoteState, event: VoiceNoteEvent): VoiceNoteStep {
  const unchanged: VoiceNoteStep = { state, effects: [] }

  switch (event.type) {
    case 'discard':
      return toIdle(TEARDOWN)

    case 'press': {
      if (state.phase !== 'idle') return unchanged
      const request = { anchor: { x: event.x, y: event.y }, locked: event.locked }
      return {
        state: { phase: 'idle', request, releasedEarly: false },
        effects: [DRAG_HOME, { type: 'requestMic', request }]
      }
    }

    case 'micGranted': {
      const dropStream: VoiceNoteEffect = { type: 'dropStream', stream: event.stream }
      if (state.phase !== 'idle' || event.request !== state.request) {
        return { state, effects: [dropStream] }
      }
      if (state.releasedEarly) return toIdle(dropStream, HINT)
      return {
        state: {
          phase: 'recording',
          anchor: event.request.anchor,
          startedAt: event.now,
          locked: event.request.locked,
          cancelArmed: false,
          stopping: null
        },
        effects: [{ type: 'record', stream: event.stream, startedAt: event.now }]
      }
    }

    case 'micRefused':
      if (state.phase !== 'idle' || event.request !== state.request) return unchanged
      return toIdle({ type: 'micError' })

    case 'move': {
      if (state.phase !== 'recording' || state.locked || state.stopping) return unchanged
      const cancelPx = Math.min(0, event.x - state.anchor.x)
      const lockPx = Math.max(0, state.anchor.y - event.y)
      if (lockPx > LOCK_THRESHOLD_PX) {
        return {
          state: { ...state, locked: true, cancelArmed: false },
          effects: [HAPTIC]
        }
      }
      const drag: VoiceNoteEffect = {
        type: 'drag',
        x: Math.max(cancelPx, -CANCEL_THRESHOLD_PX),
        y: -Math.min(lockPx, LOCK_THRESHOLD_PX)
      }
      const cancelArmed = cancelPx < -CANCEL_THRESHOLD_PX
      if (cancelArmed === state.cancelArmed) return { state, effects: [drag] }
      return { state: { ...state, cancelArmed }, effects: cancelArmed ? [HAPTIC, drag] : [drag] }
    }

    case 'release':
      if (state.phase === 'idle') {
        if (!state.request || state.releasedEarly) return unchanged
        return { state: { ...state, releasedEarly: true }, effects: [] }
      }
      if (state.phase !== 'recording' || state.locked || state.stopping) return unchanged
      if (state.cancelArmed) return toIdle(HAPTIC, TEARDOWN)
      if (event.now - state.startedAt < MIN_SEND_MS) return toIdle(TEARDOWN, HINT)
      return { state: { ...state, stopping: 'send' }, effects: [STOP_RECORDER] }

    case 'stop':
      if (state.phase !== 'recording' || state.stopping) return unchanged
      return { state: { ...state, stopping: 'preview' }, effects: [STOP_RECORDER] }

    case 'recorderStopped': {
      if (state.phase !== 'recording') return unchanged
      const { file } = event
      if (state.cancelArmed || !file) return toIdle(TEARDOWN)
      if (state.stopping === 'send') return toIdle({ type: 'send', file }, TEARDOWN)
      return {
        state: { phase: 'preview', file },
        effects: [{ type: 'openPreview', file }]
      }
    }

    case 'sendPreview':
      if (state.phase !== 'preview') return unchanged
      return toIdle({ type: 'send', file: state.file }, TEARDOWN)
  }
}
