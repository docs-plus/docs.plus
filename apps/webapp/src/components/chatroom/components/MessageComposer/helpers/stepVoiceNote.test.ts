import type { VoiceMicRequest, VoiceNoteEvent, VoiceNoteState } from '../types'
import { MIN_SEND_MS, stepVoiceNote, VOICE_NOTE_IDLE } from './stepVoiceNote'

// jsdom has no MediaStream; the step only passes the stream through.
const stream = {} as MediaStream
const file = new File(['voice'], 'voice.webm', { type: 'audio/webm' })

/** Runs events from `state` and collects every effect type in order. */
const run = (state: VoiceNoteState, ...events: VoiceNoteEvent[]) => {
  const effects: string[] = []
  for (const event of events) {
    const next = stepVoiceNote(state, event)
    state = next.state
    effects.push(...next.effects.map((effect) => effect.type))
  }
  return { state, effects }
}

const press = (locked = false) => {
  const { state } = stepVoiceNote(VOICE_NOTE_IDLE, { type: 'press', x: 100, y: 500, locked })
  if (state.phase !== 'idle' || !state.request) throw new Error('press did not request the mic')
  return { pending: state, request: state.request }
}

const granted = (request: VoiceMicRequest, now = 0): VoiceNoteEvent => ({
  type: 'micGranted',
  request,
  stream,
  now
})

const recording = () => {
  const { pending, request } = press()
  return run(pending, granted(request)).state
}

describe('stepVoiceNote', () => {
  it('drops the stream and shows the hint when a tap ends before the microphone answers', () => {
    const { pending, request } = press()
    const { state, effects } = run(pending, { type: 'release', now: 50 }, granted(request))
    expect(effects).toEqual(['dropStream', 'hint'])
    expect(state).toBe(VOICE_NOTE_IDLE)
  })

  it('shows the microphone error when a refusal follows an early release', () => {
    const { pending, request } = press()
    const { state, effects } = run(
      pending,
      { type: 'release', now: 50 },
      { type: 'micRefused', request }
    )
    expect(effects).toEqual(['micError'])
    expect(state).toBe(VOICE_NOTE_IDLE)
  })

  it('tears down with the hint and never sends when a hold ends under the minimum', () => {
    const { state, effects } = run(recording(), { type: 'release', now: MIN_SEND_MS - 1 })
    expect(effects).toEqual(['teardown', 'hint'])
    expect(state).toBe(VOICE_NOTE_IDLE)
  })

  it('sends the note when a long hold is released and the recorder stops', () => {
    const { state, effects } = run(
      recording(),
      { type: 'release', now: MIN_SEND_MS },
      { type: 'recorderStopped', file }
    )
    expect(effects).toEqual(['stopRecorder', 'send', 'teardown'])
    expect(state).toBe(VOICE_NOTE_IDLE)
  })

  it('cancels without sending after a slide left past the cancel line', () => {
    const { state, effects } = run(
      recording(),
      { type: 'move', x: 0, y: 500 },
      { type: 'release', now: MIN_SEND_MS }
    )
    expect(effects).toEqual(['haptic', 'drag', 'haptic', 'teardown'])
    expect(state).toBe(VOICE_NOTE_IDLE)
  })

  it('locks on a slide up, ignores the release, and sends from the preview', () => {
    const locked = run(recording(), { type: 'move', x: 100, y: 400 })
    expect(locked.state).toMatchObject({ phase: 'recording', locked: true })

    const released = run(locked.state, { type: 'release', now: MIN_SEND_MS })
    expect(released.state).toBe(locked.state)
    expect(released.effects).toEqual([])

    const preview = run(locked.state, { type: 'stop' }, { type: 'recorderStopped', file })
    expect(preview.state).toEqual({ phase: 'preview', file })
    expect(preview.effects).toEqual(['stopRecorder', 'openPreview'])

    const sent = run(preview.state, { type: 'sendPreview' })
    expect(sent.effects).toEqual(['send', 'teardown'])
    expect(sent.state).toBe(VOICE_NOTE_IDLE)
  })

  it('starts a menu press as a locked recording once the microphone answers', () => {
    const { pending, request } = press(true)
    const { state, effects } = run(pending, granted(request))
    expect(state).toMatchObject({ phase: 'recording', locked: true, cancelArmed: false })
    expect(effects).toEqual(['record'])
  })

  it('only drops the stream when the microphone answers after a discard', () => {
    const { pending, request } = press()
    const discarded = run(pending, { type: 'discard' })
    const { state, effects } = run(discarded.state, granted(request))
    expect(effects).toEqual(['dropStream'])
    expect(state).toBe(VOICE_NOTE_IDLE)
  })

  it('keeps the same state object for a move under both thresholds', () => {
    const held = recording()
    const next = stepVoiceNote(held, { type: 'move', x: 90, y: 490 })
    expect(next.state).toBe(held)
    expect(next.effects.map((effect) => effect.type)).toEqual(['drag'])
  })
})
