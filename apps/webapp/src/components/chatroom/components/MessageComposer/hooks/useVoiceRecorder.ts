import * as toast from '@components/toast'
import { useCallback, useRef, useState } from 'react'

const MAX_RECORD_MS = 5 * 60 * 1000
const CANCEL_THRESHOLD_PX = 80
const LOCK_THRESHOLD_PX = 80
const WAVEFORM_BAR_COUNT = 24

export type VoiceRecorderPhase = 'idle' | 'recording' | 'preview'

export type UseVoiceRecorderOptions = {
  onAttach: (file: File) => void
  attachmentCount: number
  maxAttachments: number
  onAuthRequired: () => void
  userId: string | undefined
}

const formatElapsed = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const stripMime = (mime: string): string =>
  (mime || 'audio/webm').split(';')[0]?.trim() || 'audio/webm'

export function useVoiceRecorder({
  onAttach,
  attachmentCount,
  maxAttachments,
  onAuthRequired,
  userId
}: UseVoiceRecorderOptions) {
  const [phase, setPhase] = useState<VoiceRecorderPhase>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [waveformLevels, setWaveformLevels] = useState<number[]>(() =>
    Array.from({ length: WAVEFORM_BAR_COUNT }, () => 0.15)
  )
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

  const resetGesture = useCallback(() => {
    setIsCancelArmed(false)
    setIsLocked(false)
    isCancelArmedRef.current = false
    isLockedRef.current = false
  }, [])

  const resetToIdle = useCallback(() => {
    clearTimers()
    recorderRef.current = null
    chunksRef.current = []
    releaseStream()
    revokePreview()
    resetGesture()
    setPhase('idle')
    setElapsedMs(0)
    setWaveformLevels(Array.from({ length: WAVEFORM_BAR_COUNT }, () => 0.15))
  }, [clearTimers, releaseStream, revokePreview, resetGesture])

  const cancelRecording = useCallback(() => {
    clearTimers()
    try {
      recorderRef.current?.stop()
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
  }, [clearTimers, releaseStream, revokePreview, resetGesture])

  const stopRecording = useCallback(() => {
    if (phase !== 'recording') return
    clearTimers()
    recorderRef.current?.stop()
  }, [clearTimers, phase])

  const startWaveformLoop = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return

    const data = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteFrequencyData(data)
      const slice = Math.max(1, Math.floor(data.length / WAVEFORM_BAR_COUNT))
      const levels = Array.from({ length: WAVEFORM_BAR_COUNT }, (_, i) => {
        const start = i * slice
        let sum = 0
        for (let j = start; j < start + slice && j < data.length; j++) sum += data[j] ?? 0
        const avg = sum / slice
        return Math.max(0.12, Math.min(1, avg / 128))
      })
      setWaveformLevels(levels)
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

      anchorRef.current = { x: clientX, y: clientY }
      resetGesture()

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
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

        recorder.onstop = () => {
          releaseStream()

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

          const file = new File([blob], `voice-${Date.now()}.webm`, { type: mimeType })
          revokePreview()
          const url = URL.createObjectURL(blob)
          setPreviewFile(file)
          setPreviewUrl(url)
          setPhase('preview')
        }

        recorder.start()
        setPhase('recording')
        setElapsedMs(0)
        const startedAt = Date.now()
        tickRef.current = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 250)
        stopTimerRef.current = window.setTimeout(() => stopRecording(), MAX_RECORD_MS)
        startWaveformLoop()
      } catch {
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
      startWaveformLoop,
      stopRecording,
      userId
    ]
  )

  const moveHold = useCallback(
    (clientX: number, clientY: number) => {
      if (phase !== 'recording' || isLockedRef.current) return

      const cancelPx = Math.min(0, clientX - anchorRef.current.x)
      const lockPx = Math.max(0, anchorRef.current.y - clientY)

      const cancelArmed = cancelPx < -CANCEL_THRESHOLD_PX
      const locked = lockPx > LOCK_THRESHOLD_PX

      setIsCancelArmed(cancelArmed)
      isCancelArmedRef.current = cancelArmed

      if (locked) {
        setIsLocked(true)
        isLockedRef.current = true
        setIsCancelArmed(false)
        isCancelArmedRef.current = false
      }
    },
    [phase]
  )

  const endHold = useCallback(() => {
    if (phase !== 'recording') return
    if (isLockedRef.current) return
    if (isCancelArmedRef.current) {
      cancelRecording()
      return
    }
    stopRecording()
  }, [cancelRecording, phase, stopRecording])

  const confirmAttach = useCallback(() => {
    if (!previewFile) return
    onAttach(previewFile)
    revokePreview()
    setPhase('idle')
    setElapsedMs(0)
  }, [onAttach, previewFile, revokePreview])

  const discardPreview = useCallback(() => {
    revokePreview()
    setPhase('idle')
    setElapsedMs(0)
  }, [revokePreview])

  const stopAndCleanup = useCallback(() => {
    if (phase === 'recording') {
      isCancelArmedRef.current = true
      cancelRecording()
      return
    }
    if (phase === 'preview') {
      discardPreview()
      return
    }
    resetToIdle()
  }, [cancelRecording, discardPreview, phase, resetToIdle])

  const startLockedFromMenu = useCallback(async () => {
    if (phase !== 'idle') return
    await startHold(0, 0)
    isLockedRef.current = true
    setIsLocked(true)
  }, [phase, startHold])

  return {
    phase,
    elapsedMs,
    elapsedLabel: formatElapsed(elapsedMs),
    previewUrl,
    waveformLevels,
    isCancelArmed,
    isLocked,
    isActive: phase === 'recording' || phase === 'preview',
    startHold,
    moveHold,
    endHold,
    stopRecording,
    cancelRecording,
    confirmAttach,
    discardPreview,
    stopAndCleanup,
    startLockedFromMenu
  }
}

export type UseVoiceRecorderReturn = ReturnType<typeof useVoiceRecorder>
