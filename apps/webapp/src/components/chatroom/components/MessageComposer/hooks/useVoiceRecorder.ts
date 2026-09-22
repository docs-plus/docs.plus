import { formatAudioClock, voiceNoteFileName } from '@components/chatroom/utils/chatAudio'
import * as toast from '@components/toast'
import { useCallback, useEffect, useRef, useState } from 'react'

import { dismissComposerOverlaysBeforeVoice } from '../helpers/dismissComposerOverlays'
import { startComposerActivity, stopComposerActivity } from '../helpers/handleTypingIndicator'

const MAX_RECORD_MS = 5 * 60 * 1000
const CANCEL_THRESHOLD_PX = 80
const LOCK_THRESHOLD_PX = 80
// Live input bars while recording; the stored note waveform is AUDIO_WAVEFORM_BARS.
const LIVE_LEVEL_BARS = 24
const IDLE_LEVELS = Array.from({ length: LIVE_LEVEL_BARS }, () => 0.15)
// A shorter hold sends nothing and shows the hold hint.
const MIN_SEND_MS = 1000

const showHoldHint = () =>
  toast.Info('Hold the mic to record, release to send', { id: 'voice-hold-hint' })

// Android only: iOS Safari has no Vibration API.
const haptic = () => {
  if ('vibrate' in navigator) navigator.vibrate(10)
}

export type VoiceRecorderPhase = 'idle' | 'recording' | 'preview'

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
  const [phase, setPhase] = useState<VoiceRecorderPhase>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [liveLevels, setLiveLevels] = useState<number[]>(IDLE_LEVELS)
  const [isCancelArmed, setIsCancelArmed] = useState(false)
  const [isLocked, setIsLocked] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const stopTimerRef = useRef<number | null>(null)
  const tickRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const anchorRef = useRef({ x: 0, y: 0 })
  const isLockedRef = useRef(false)
  const isCancelArmedRef = useRef(false)
  // A release or a cleanup during the microphone request changes this id.
  // The pending start then stops its stream and does not record.
  const startIdRef = useRef(0)
  // A tap, or a permission prompt that takes the touch, ends the hold before the microphone answers.
  const releasedEarlyRef = useRef(false)
  const startedAtRef = useRef(0)
  // A hold release stops the recorder to send. Stop and the 5-minute cap open the preview.
  const sendOnStopRef = useRef(false)
  // The composer root. A drag writes CSS variables here, not React state, so a move does not re-render.
  const dragSurfaceRef = useRef<HTMLDivElement>(null)
  const onSendRef = useRef(onSend)
  onSendRef.current = onSend

  // Held or locked. Preview, cancel, and the 5-minute cap all leave this phase.
  useEffect(() => {
    if (phase !== 'recording') return
    startComposerActivity('recordingVoice')
    return () => stopComposerActivity('recordingVoice')
  }, [phase])

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

  const revokePreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewFile(null)
  }, [previewUrl])

  const setDragOffset = useCallback((x: number, y: number) => {
    const style = dragSurfaceRef.current?.style
    if (!style) return
    style.setProperty('--voice-drag-x', `${x}px`)
    style.setProperty('--voice-drag-y', `${y}px`)
    style.setProperty('--voice-cancel-progress', String(-x / CANCEL_THRESHOLD_PX))
  }, [])

  const resetGesture = useCallback(() => {
    setIsCancelArmed(false)
    setIsLocked(false)
    isCancelArmedRef.current = false
    isLockedRef.current = false
    setDragOffset(0, 0)
  }, [setDragOffset])

  // Every user action back to idle: Cancel, Discard, a short hold, an overlay, and unmount.
  const discard = useCallback(() => {
    startIdRef.current++
    sendOnStopRef.current = false
    clearTimers()
    const recorder = recorderRef.current
    // The recorder fires its stop event in a later task, after the reset below.
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
    revokePreview()
    resetGesture()
    setPhase('idle')
    setElapsedMs(0)
    setLiveLevels(IDLE_LEVELS)
  }, [clearTimers, releaseStream, revokePreview, resetGesture])

  // Read the live recorder, not this render's phase.
  // The cap timer and the hold listeners keep old copies of this callback.
  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder?.state !== 'recording') return
    clearTimers()
    recorder.stop()
  }, [clearTimers])

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

  const startHold = useCallback(
    async (clientX: number, clientY: number) => {
      if (phase === 'recording' || phase === 'preview') return

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
      anchorRef.current = { x: clientX, y: clientY }
      resetGesture()
      const startId = ++startIdRef.current
      releasedEarlyRef.current = false

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (startId !== startIdRef.current) {
          stream.getTracks().forEach((track) => track.stop())
          if (releasedEarlyRef.current) showHoldHint()
          return
        }
        streamRef.current = stream
        chunksRef.current = []

        const audioContext = new AudioContext()
        const source = audioContext.createMediaStreamSource(stream)
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 64
        source.connect(analyser)
        audioContextRef.current = audioContext
        analyserRef.current = analyser

        const recorder = new MediaRecorder(stream)
        recorderRef.current = recorder

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data)
        }

        // A recorder can stop on its own (a lost device), so clear here too.
        recorder.onstop = () => {
          clearTimers()
          setLiveLevels(IDLE_LEVELS)
          releaseStream()
          const send = sendOnStopRef.current
          sendOnStopRef.current = false

          if (isCancelArmedRef.current) {
            chunksRef.current = []
            resetGesture()
            setPhase('idle')
            setElapsedMs(0)
            return
          }

          const mimeType = stripMime(recorder.mimeType)
          const blob = new Blob(chunksRef.current, { type: mimeType })
          chunksRef.current = []
          resetGesture()

          if (blob.size === 0) {
            setPhase('idle')
            setElapsedMs(0)
            return
          }

          const file = new File([blob], voiceNoteFileName(mimeType), { type: mimeType })
          if (send) {
            onSendRef.current(file)
            setPhase('idle')
            setElapsedMs(0)
            return
          }
          revokePreview()
          const url = URL.createObjectURL(blob)
          setPreviewFile(file)
          setPreviewUrl(url)
          setPhase('preview')
        }

        recorder.start()
        haptic()
        setPhase('recording')
        setElapsedMs(0)
        startedAtRef.current = Date.now()
        tickRef.current = window.setInterval(
          () => setElapsedMs(Date.now() - startedAtRef.current),
          250
        )
        stopTimerRef.current = window.setTimeout(() => stopRecording(), MAX_RECORD_MS)
        startLevelLoop()
      } catch {
        // A replaced start must not tear down the recording that replaced it.
        // A newer start resets releasedEarlyRef, so only an early release shows the error.
        if (startId !== startIdRef.current) {
          if (releasedEarlyRef.current) toast.Error('Microphone access denied or unavailable')
          return
        }
        clearTimers()
        releaseStream()
        resetGesture()
        setPhase('idle')
        toast.Error('Microphone access denied or unavailable')
      }
    },
    [
      attachmentCount,
      clearTimers,
      maxAttachments,
      onAuthRequired,
      phase,
      releaseStream,
      resetGesture,
      revokePreview,
      startLevelLoop,
      stopRecording,
      userId
    ]
  )

  const moveHold = useCallback(
    (clientX: number, clientY: number) => {
      if (recorderRef.current?.state !== 'recording' || isLockedRef.current) return

      const cancelPx = Math.min(0, clientX - anchorRef.current.x)
      const lockPx = Math.max(0, anchorRef.current.y - clientY)

      const cancelArmed = cancelPx < -CANCEL_THRESHOLD_PX
      const locked = lockPx > LOCK_THRESHOLD_PX

      if (cancelArmed !== isCancelArmedRef.current) {
        if (cancelArmed) haptic()
        isCancelArmedRef.current = cancelArmed
        setIsCancelArmed(cancelArmed)
      }
      setDragOffset(Math.max(cancelPx, -CANCEL_THRESHOLD_PX), -Math.min(lockPx, LOCK_THRESHOLD_PX))

      if (locked) {
        haptic()
        setIsLocked(true)
        isLockedRef.current = true
        setIsCancelArmed(false)
        isCancelArmedRef.current = false
        setDragOffset(0, 0)
      }
    },
    [setDragOffset]
  )

  const endHold = useCallback(() => {
    startIdRef.current++
    if (recorderRef.current?.state !== 'recording') {
      releasedEarlyRef.current = true
      return
    }
    if (isLockedRef.current) return
    if (isCancelArmedRef.current) {
      haptic()
      discard()
      return
    }
    if (Date.now() - startedAtRef.current < MIN_SEND_MS) {
      discard()
      showHoldHint()
      return
    }
    sendOnStopRef.current = true
    stopRecording()
  }, [discard, stopRecording])

  const sendPreview = useCallback(() => {
    if (!previewFile) return
    onSendRef.current(previewFile)
    discard()
  }, [discard, previewFile])

  const startLockedFromMenu = useCallback(async () => {
    if (phase !== 'idle') return
    await startHold(0, 0)
    isLockedRef.current = true
    setIsLocked(true)
  }, [phase, startHold])

  return {
    phase,
    elapsedLabel: formatAudioClock(elapsedMs / 1000),
    previewUrl,
    liveLevels,
    isCancelArmed,
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
