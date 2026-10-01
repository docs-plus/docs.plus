import { FeedSpoilerRevealOverlay } from '@components/chatroom/components/MediaSpoilerReveal'
import { useFeedMediaDisplayUrl } from '@components/chatroom/hooks/useMediaSignedUrl'
import {
  AUDIO_WAVEFORM_BARS,
  formatAudioClock,
  isVoiceNoteName
} from '@components/chatroom/utils/chatAudio'
import { useSpoilerGatedActivate } from '@components/chatroom/utils/feedSpoilerReveal'
import { messageMediaTheme } from '@components/chatroom/utils/messageMediaTheme'
import { Icons } from '@icons'
import type { MessageMediaItem } from '@types'
import { twMerge } from '@utils/twMerge'
import { type ReactNode, useEffect, useRef, useState } from 'react'

import { MediaUnavailable } from './MediaUnavailable'

type Props = {
  media: MessageMediaItem
  onOpen?: () => void
}

const PLAYBACK_RATES = [1, 1.5, 2] as const
// A row with no stored waveform still shows progress on even bars.
const FLAT_WAVEFORM = Array.from({ length: AUDIO_WAVEFORM_BARS }, () => 30)

// One clip plays at a time across the feed.
let playingAudio: HTMLAudioElement | null = null

const theme = messageMediaTheme('audio')

export function MessageMediaAudio({ media, onOpen }: Props) {
  const voice = isVoiceNoteName(media.name)
  const { url: resolvedUrl, ref: visibilityRef, signFailed, retry } = useFeedMediaDisplayUrl(media)
  const { isSpoiler, onActivate: onExpand } = useSpoilerGatedActivate(media, onOpen, {
    ready: Boolean(resolvedUrl),
    preventDefault: true
  })
  const [playbackFailed, setPlaybackFailed] = useState(false)
  const unavailable = signFailed || playbackFailed
  const playable = !isSpoiler && resolvedUrl && !unavailable

  const nameRow = voice ? null : (
    <p className="text-base-content truncate text-xs font-medium">
      {media.name?.trim() || 'Audio attachment'}
    </p>
  )

  return (
    <div
      ref={visibilityRef}
      className={twMerge(
        'group/audio rounded-field relative flex max-w-sm items-center gap-2.5 border px-3 py-2.5',
        // The expand button sits top-right and stays visible on phones; keep the speed chip clear of it.
        playable && onOpen && 'pr-10',
        theme.cardBorder,
        theme.cardSurface
      )}>
      {playable ? (
        // A re-signed URL reloads the element, so its playback state starts over with it.
        <AudioPlayback
          key={resolvedUrl}
          src={resolvedUrl}
          media={media}
          noun={voice ? 'voice note' : 'audio'}
          nameRow={nameRow}
          onError={() => setPlaybackFailed(true)}
        />
      ) : (
        <>
          <div
            className={twMerge(
              'flex size-10 shrink-0 items-center justify-center rounded-full',
              theme.iconBg
            )}>
            <Icons.music size={18} className={theme.accent} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            {nameRow}
            {isSpoiler ? (
              <button
                type="button"
                className="rounded-field bg-base-300/40 relative mt-1 flex h-8 w-full min-w-[180px] cursor-pointer items-center justify-center overflow-hidden border-0 p-0"
                aria-label="Reveal spoiler audio"
                data-testid="feed-spoiler-reveal"
                onClick={onExpand}>
                <FeedSpoilerRevealOverlay />
              </button>
            ) : unavailable ? (
              <MediaUnavailable
                kind="audio"
                label="Audio unavailable"
                className="mt-1 min-h-0 bg-transparent p-0"
                onRetry={() => {
                  setPlaybackFailed(false)
                  retry()
                }}
              />
            ) : (
              <div className="skeleton mt-1 h-8 w-full min-w-[180px]" aria-hidden />
            )}
          </div>
        </>
      )}
      {playable && onOpen ? (
        <button
          type="button"
          onClick={onExpand}
          className="btn btn-ghost btn-xs btn-square absolute top-2 right-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/audio:opacity-100 sm:focus-visible:opacity-100"
          aria-label="Expand audio">
          <Icons.maximize2 size={14} />
        </button>
      ) : null}
    </div>
  )
}

type PlaybackProps = {
  src: string
  media: MessageMediaItem
  noun: string
  nameRow: ReactNode
  onError: () => void
}

function AudioPlayback({ src, media, noun, nameRow, onError }: PlaybackProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [loadedDuration, setLoadedDuration] = useState(0)
  const [rateIndex, setRateIndex] = useState(0)

  // The file's own length wins; the stored one covers the time before load and WebM's Infinity.
  const duration = loadedDuration || media.duration || 0
  const bars = media.waveform ?? FLAT_WAVEFORM
  const progress = duration > 0 ? position / duration : 0
  const started = playing || position > 0
  const rate = PLAYBACK_RATES[rateIndex]

  // A virtualized row can unmount mid-play; a detached element would keep playing with no control.
  useEffect(() => {
    const audio = audioRef.current
    return () => {
      audio?.pause()
      if (playingAudio === audio) playingAudio = null
    }
  }, [])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    // A quick pause rejects play() with AbortError; a real failure fires the element's error event.
    if (audio.paused) audio.play().catch(() => {})
    else audio.pause()
  }

  const cycleRate = () => {
    const next = (rateIndex + 1) % PLAYBACK_RATES.length
    setRateIndex(next)
    if (audioRef.current) audioRef.current.playbackRate = PLAYBACK_RATES[next]
  }

  const seek = (seconds: number) => {
    if (audioRef.current) audioRef.current.currentTime = seconds
    setPosition(seconds)
  }

  return (
    <>
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={(event) => {
          if (playingAudio && playingAudio !== event.currentTarget) playingAudio.pause()
          playingAudio = event.currentTarget
          setPlaying(true)
        }}
        onPause={(event) => {
          if (playingAudio === event.currentTarget) playingAudio = null
          setPlaying(false)
        }}
        onEnded={() => seek(0)}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onDurationChange={(event) => {
          const loaded = event.currentTarget.duration
          if (Number.isFinite(loaded) && loaded > 0) setLoadedDuration(loaded)
        }}
        onError={onError}
      />
      <button
        type="button"
        onClick={togglePlay}
        className={twMerge('btn btn-circle size-10 shrink-0 border-0', theme.iconBg, theme.accent)}
        aria-label={playing ? `Pause ${noun}` : `Play ${noun}`}>
        {playing ? (
          <Icons.pause size={18} aria-hidden />
        ) : (
          <Icons.play size={18} className="translate-x-px" aria-hidden />
        )}
      </button>
      <div className="min-w-0 flex-1">
        {nameRow}
        <div className="flex items-center gap-2">
          <div className="rounded-field has-[input:focus-visible]:ring-primary relative flex h-8 min-w-[120px] flex-1 items-center gap-px has-[input:focus-visible]:ring-2">
            {bars.map((level, index) => (
              <span
                key={index}
                aria-hidden
                className={twMerge(
                  'flex-1 rounded-full',
                  index / bars.length < progress ? 'bg-base-content/70' : 'bg-base-content/25'
                )}
                style={{ height: `${Math.max(12, level)}%` }}
              />
            ))}
            {/* A native range over the bars gives drag, arrow keys, and a screen-reader value. */}
            <input
              type="range"
              min={0}
              max={duration}
              step={1}
              value={Math.min(position, duration)}
              disabled={!duration}
              onChange={(event) => seek(Number(event.target.value))}
              aria-label={`Seek ${noun}`}
              aria-valuetext={`${formatAudioClock(position)} of ${formatAudioClock(duration)}`}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
            />
          </div>
          <span className="text-base-content/60 shrink-0 text-xs tabular-nums">
            {started ? formatAudioClock(position) : duration ? formatAudioClock(duration) : null}
          </span>
          {/* Invisible until play, so the bars do not shrink when the chip appears. */}
          <button
            type="button"
            onClick={cycleRate}
            className={twMerge(
              'btn btn-ghost btn-xs shrink-0 px-1 tabular-nums',
              !started && 'invisible'
            )}
            aria-label={`Playback speed ${rate}×`}>
            {rate}×
          </button>
        </div>
      </div>
    </>
  )
}
