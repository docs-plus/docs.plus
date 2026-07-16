import { Icons } from '@icons'
import { useCallback, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

import { useMessageComposer } from '../../../hooks/useMessageComposer'
import type { UseVoiceRecorderReturn } from '../../../hooks/useVoiceRecorder'
import Button from '../../ui/Button'

type Props = {
  voice: UseVoiceRecorderReturn
  className?: string
}

export function ComposerPrimaryAction({ voice, className }: Props) {
  const { canSend, submitMessage, isMobile } = useMessageComposer()
  const listeningRef = useRef(false)

  const iconSize = isMobile ? 20 : 18
  const btnSize = isMobile
    ? 'size-11 min-h-11 min-w-11 rounded-field'
    : 'size-8 min-h-8 min-w-8 rounded-field'

  const bindHoldListeners = useCallback(() => {
    if (listeningRef.current) return
    listeningRef.current = true

    const onMove = (event: PointerEvent) => {
      voice.moveHold(event.clientX, event.clientY)
    }

    const onUp = () => {
      listeningRef.current = false
      voice.endHold()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }, [voice])

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!isMobile || canSend || voice.phase === 'preview') return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      bindHoldListeners()
      void voice.startHold(event.clientX, event.clientY)
    },
    [bindHoldListeners, canSend, isMobile, voice]
  )

  const onPress = useCallback(() => {
    if (isMobile || canSend || voice.phase !== 'idle') return
    void voice.startLockedFromMenu()
  }, [canSend, isMobile, voice])

  if (voice.phase === 'preview') return null

  if (canSend) {
    // Ghost + primary ink — same species as + / emoji / mic. A filled primary disc
    // fights the composer toolbar recipe (Discord uses a brand disc; our row does not).
    return (
      <Button
        variant="ghost"
        className={twMerge(
          btnSize,
          'text-primary shrink-0 border-0 p-0 motion-safe:transition-transform motion-safe:duration-100 motion-safe:ease-out motion-safe:active:scale-95',
          className
        )}
        disabled={!canSend}
        type="submit"
        data-testid="composer-primary-action"
        onPress={submitMessage}
        onPointerDown={(e: React.PointerEvent<HTMLButtonElement>) => {
          if (isMobile) e.preventDefault()
        }}
        aria-label="Send message">
        <Icons.send size={iconSize} className="pointer-events-none shrink-0 stroke-[1.75]" />
      </Button>
    )
  }

  return (
    <Button
      className={twMerge(
        btnSize,
        'shrink-0 border-0 p-0',
        voice.phase === 'recording' && 'text-error',
        className
      )}
      data-testid="composer-primary-action"
      onPointerDown={onPointerDown}
      onPress={isMobile ? undefined : onPress}
      tooltip={isMobile ? 'Hold to record' : 'Record voice note'}
      tooltipPosition="top"
      aria-label={isMobile ? 'Hold to record voice note' : 'Record voice note'}
      aria-pressed={voice.phase === 'recording'}>
      <Icons.mic size={iconSize} className="pointer-events-none shrink-0 stroke-[1.75]" />
    </Button>
  )
}
