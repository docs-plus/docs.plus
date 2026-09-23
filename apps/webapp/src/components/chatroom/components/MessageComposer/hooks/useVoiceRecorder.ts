import { formatAudioClock, voiceNoteFileName } from '@components/chatroom/utils/chatAudio'
import * as toast from '@components/toast'
import { useCallback, useEffect, useRef, useState } from 'react'

import { dismissComposerOverlaysBeforeVoice } from '../helpers/dismissComposerOverlays'
import { startComposerActivity, stopComposerActivity } from '../helpers/handleTypingIndicator'
import { CANCEL_THRESHOLD_PX, stepVoiceNote, VOICE_NOTE_IDLE } from '../helpers/stepVoiceNote'
import type { VoiceNoteEvent, VoiceNoteState } from '../types'

const MAX_RECORD_MS = 5 * 60 * 1000
// Live input bars while recording; the stored note waveform is AUDIO_WAVEFORM_BARS.
const LIVE_LEVEL_BARS = 24
const IDLE_LEVELS = Array.from({ length: LIVE_LEVEL_BARS }, () => 0.15)

const showHoldHint = () =>
  toast.Info('Hold the mic to record, release to send', { id: 'voice-hold-hint' })

const showMicError = () => toast.Error('Microphone access denied or unavailable')

// Android only: iOS Safari has no Vibration API.
const haptic = () => {
  if ('vibrate' in navigator) navigator.vibrate(10)
}

export type UseVoiceRecorderOptions = {
  /** A finished note: a released hold, or Send in the preview. */
  onSend: (file: File) => void
  attachmentCount: number
  maxAttachments: number
  onAuthRequired: () => void
  userId: string | undefined
}

const stripMime = (mime: string): string =>
  (mime || 'audio/webm').split(';')[0]?.trim() || 'audio/webm'

export function useVoiceRecorder({
  onSend,
  attachmentCount,
  maxAttachments,
  onAuthRequired,
  userId
}: UseVoiceRecorderOptions) {
  const [state, setState] = useState<VoiceNoteState>(VOICE_NOTE_IDLE)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [liveLevels, setLiveLevels] = useState<number[]>(IDLE_LEVELS)

  const stateRef = useRef<VoiceNoteState>(VOICE_NOTE_IDLE)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const stopTimerRef = useRef<number | null>(null)
  const tickRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  // The composer root. A drag writes CSS variables here, not React state, so a move does not re-render.
  const dragSurfaceRef = useRef<HTMLDivElement>(null)
  const onSendRef = useRef(onSend)
  onSendRef.current = onSend

  const { phase } = state

  // Held or locked. Preview, cancel, and the 5-minute cap all leave this phase.
  useEffect(() => {
    if (phase !== 'recording') return
    startComposerActivity('recordingVoice')
    return () => stopComposerActivity('recordingVoice')
  }, [phase])

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const clearTimers = useCallback(() => {
    if (stopTimerRef.current != null) {
      window.clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    void audioContextRef.current?.close()
    audioContextRef.current = null
    analyserRef.current = null
  }, [])

  const setDragOffset = useCallback((x: number, y: number) => {
    const style = dragSurfaceRef.current?.style
    if (!style) return
    style.setProperty('--voice-drag-x', `${x}px`)
    style.setProperty('--voice-drag-y', `${y}px`)
    style.setProperty('--voice-cancel-progress', String(-x / CANCEL_THRESHOLD_PX))
  }, [])

  const startLevelLoop = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return

    const data = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteFrequencyData(data)
      const slice = Math.max(1, Math.floor(data.length / LIVE_LEVEL_BARS))
      const levels = Array.from({ length: LIVE_LEVEL_BARS }, (_, i) => {
        const start = i * slice
        let sum = 0
        for (let j = start; j < start + slice && j < data.length; j++) sum += data[j] ?? 0
        const avg = sum / slice
        return Math.max(0.12, Math.min(1, avg / 128))
      })
      setLiveLevels(levels)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const dispatch = useCallback(
    function dispatch(event: VoiceNoteEvent): void {
      const next = stepVoiceNote(stateRef.current, event)
      if (next.state !== stateRef.current) {
        stateRef.current = next.state
        setState(next.state)
      }

      for (const effect of next.effects) {
        switch (effect.type) {
          case 'requestMic': {
            const { request } = effect
            navigator.mediaDevices.getUserMedia({ audio: true }).then(
              (stream) => dispatch({ type: 'micGranted', request, stream, now: Date.now() }),
              () => dispatch({ type: 'micRefused', request })
            )
            break
          }
          case 'dropStream':
            effect.stream.getTracks().forEach((track) => track.stop())
            break
          case 'record': {
            const { stream, startedAt } = effect
            streamRef.current = stream
            chunksRef.current = []
            try {
              const audioContext = new AudioContext()
              audioContextRef.current = audioContext
              const analyser = audioContext.createAnalyser()
              analyser.fftSize = 64
              audioContext.createMediaStreamSource(stream).connect(analyser)
              analyserRef.current = analyser

              const recorder = new MediaRecorder(stream)
              recorderRef.current = recorder
              recorder.ondataavailable = (dataEvent) => {
                if (dataEvent.data.size > 0) chunksRef.current.push(dataEvent.data)
              }
              // A recorder can stop on its own (a lost device), so clear here too.
              recorder.onstop = () => {
                clearTimers()
                setLiveLevels(IDLE_LEVELS)
                releaseStream()
                const mimeType = stripMime(recorder.mimeType)
                const blob = new Blob(chunksRef.current, { type: mimeType })
                chunksRef.current = []
                const file =
                  blob.size > 0
                    ? new File([blob], voiceNoteFileName(mimeType), { type: mimeType })
                    : null
                dispatch({ type: 'recorderStopped', file })
              }

              recorder.start()
              haptic()
              setElapsedMs(0)
              tickRef.current = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 250)
              stopTimerRef.current = window.setTimeout(
                () => dispatch({ type: 'stop' }),
                MAX_RECORD_MS
              )
              startLevelLoop()
            } catch {
              showMicError()
              dispatch({ type: 'discard' })
            }
            break
          }
          case 'drag':
            setDragOffset(effect.x, effect.y)
            break
          case 'haptic':
            haptic()
            break
          case 'hint':
            showHoldHint()
            break
          case 'micError':
            showMicError()
            break
          case 'stopRecorder': {
            clearTimers()
            // A lost device leaves the recorder inactive one task before onstop,
            // and older Safari throws on stop() of an inactive recorder.
            const recorder = recorderRef.current
            if (recorder?.state === 'recording') recorder.stop()
            break
          }
          case 'send':
            onSendRef.current(effect.file)
            break
          case 'openPreview':
            setPreviewUrl(URL.createObjectURL(effect.file))
            break
          case 'teardown': {
            clearTimers()
            const recorder = recorderRef.current
            // The recorder fires its stop event in a later task, after this reset.
            // Remove its handlers first, so that event cannot open a preview or send.
            if (recorder) {
              recorder.ondataavailable = null
              recorder.onstop = null
            }
            try {
              recorder?.stop()
            } catch {
              /* already stopped */
            }
            recorderRef.current = null
            chunksRef.current = []
            releaseStream()
            setPreviewUrl(null)
            setElapsedMs(0)
            setLiveLevels(IDLE_LEVELS)
            break
          }
        }
      }
    },
    [clearTimers, releaseStream, setDragOffset, startLevelLoop]
  )

  const press = useCallback(
    (x: number, y: number, locked: boolean) => {
      if (stateRef.current.phase !== 'idle') return

      if (!userId) {
        onAuthRequired()
        return
      }

      if (attachmentCount >= maxAttachments) {
        toast.Error(`Maximum ${maxAttachments} attachments per message`)
        return
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        toast.Error('Voice recording is not supported on this device')
        return
      }

      dismissComposerOverlaysBeforeVoice()
      dispatch({ type: 'press', x, y, locked })
    },
    [attachmentCount, dispatch, maxAttachments, onAuthRequired, userId]
  )

  const startHold = useCallback((x: number, y: number) => press(x, y, false), [press])
  const startLockedFromMenu = useCallback(() => press(0, 0, true), [press])
  const moveHold = useCallback(
    (x: number, y: number) => dispatch({ type: 'move', x, y }),
    [dispatch]
  )
  const endHold = useCallback(() => dispatch({ type: 'release', now: Date.now() }), [dispatch])
  const stopRecording = useCallback(() => dispatch({ type: 'stop' }), [dispatch])
  const sendPreview = useCallback(() => dispatch({ type: 'sendPreview' }), [dispatch])
  const discard = useCallback(() => dispatch({ type: 'discard' }), [dispatch])

  const isLocked = state.phase === 'recording' && state.locked

  return {
    phase,
    elapsedLabel: formatAudioClock(elapsedMs / 1000),
    previewUrl,
    liveLevels,
    isCancelArmed: state.phase === 'recording' && state.cancelArmed,
    isLocked,
    // Only a phone holds: desktop recording always starts locked.
    isHolding: phase === 'recording' && !isLocked,
    dragSurfaceRef,
    startHold,
    moveHold,
    endHold,
    stopRecording,
    sendPreview,
    discard,
    startLockedFromMenu
  }
}

export type UseVoiceRecorderReturn = ReturnType<typeof useVoiceRecorder>
