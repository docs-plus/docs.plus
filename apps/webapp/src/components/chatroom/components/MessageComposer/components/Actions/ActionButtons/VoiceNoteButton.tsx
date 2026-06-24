import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { openComposerSignIn } from '@components/chatroom/utils/openComposerSignIn'
import * as toast from '@components/toast'
import { Icons } from '@icons'
import { useAuthStore } from '@stores'
import { useCallback, useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { useComposerAttachmentActions } from '../../../hooks'
import Button from '../../ui/Button'

const MAX_RECORD_MS = 5 * 60 * 1000

const formatElapsed = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

type Props = React.ComponentProps<typeof Button> & {
  size?: number
}

export const VoiceNoteButton = ({ className, size = 18, ...props }: Props) => {
  const { channelId } = useChatroomContext()
  const user = useAuthStore((state) => state.profile)
  const { addFiles } = useComposerAttachmentActions()
  const [recording, setRecording] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const stopTimerRef = useRef<number | null>(null)
  const tickRef = useRef<number | null>(null)

  const clearTimers = useCallback(() => {
    if (stopTimerRef.current != null) {
      window.clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [])

  const stopRecording = useCallback(() => {
    clearTimers()
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
  }, [clearTimers])

  useEffect(() => {
    return () => {
      stopRecording()
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [stopRecording])

  const onPress = useCallback(async () => {
    if (!user?.id) {
      openComposerSignIn(channelId)
      return
    }

    if (recording) {
      stopRecording()
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      toast.Error('Voice recording is not supported on this device')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null

        // Strip the codec parameter (`audio/webm;codecs=opus`) so the stored
        // File.type matches the storage bucket allowlist's bare `audio/webm`.
        const mimeType = (recorder.mimeType || 'audio/webm').split(';')[0]?.trim() || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })
        if (blob.size === 0) return

        const file = new File([blob], `voice-${Date.now()}.webm`, { type: mimeType })
        addFiles([file])
      }

      recorder.start()
      setRecording(true)
      setElapsedMs(0)
      const startedAt = Date.now()
      tickRef.current = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 250)
      stopTimerRef.current = window.setTimeout(() => stopRecording(), MAX_RECORD_MS)
    } catch {
      clearTimers()
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setRecording(false)
      toast.Error('Microphone access denied or unavailable')
    }
  }, [addFiles, channelId, clearTimers, recording, stopRecording, user?.id])

  return (
    <>
      <Button
        className={twMerge(
          'size-9 min-h-0 min-w-9 shrink-0 rounded-lg border-0 p-0 sm:size-8 sm:min-h-0 sm:min-w-8',
          recording && 'text-error',
          className
        )}
        onPress={() => void onPress()}
        tooltip={recording ? `Stop recording (${formatElapsed(elapsedMs)})` : 'Record voice note'}
        tooltipPosition="top"
        aria-label={recording ? 'Stop voice recording' : 'Record voice note'}
        aria-pressed={recording}
        {...props}>
        <Icons.mic
          size={size}
          className={twMerge(
            'pointer-events-none shrink-0 stroke-[1.75]',
            recording && 'motion-safe:animate-pulse'
          )}
        />
      </Button>
      {recording ? (
        <span className="sr-only" role="status" aria-live="polite">
          Recording {formatElapsed(elapsedMs)}
        </span>
      ) : null}
    </>
  )
}
