import React, { useState, useRef, ReactElement } from 'react'
import { VscPinnedDirty } from 'react-icons/vsc'

type PinnedMessage = {
  content: string
}

interface PinnedMessagesSliderProps {
  pinnedMessagesMap: Map<number, PinnedMessage>
}

export default function PinnedMessagesSlider({
  pinnedMessagesMap
}: PinnedMessagesSliderProps): ReactElement | null {
  const [activeStep, setActiveStep] = useState<number>(0)
  const pinnedMessages: PinnedMessage[] = Array.from(pinnedMessagesMap.values()).reverse()
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([])

  const handleClick = (index: number): void => {
    setActiveStep(index)
    buttonsRef.current?.[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (pinnedMessages.length === 0) return null

  return (
    <div className="relative flex w-full items-center justify-start p-2">
      <div className="mr-2 flex h-12 flex-col gap-1 overflow-hidden">
        {pinnedMessages.map((_, index) => (
          <button
            key={index}
            type="button"
            ref={(el) => {
              buttonsRef.current[index] = el
            }}
            className={`w-1 flex-1 rounded-full transition-colors duration-200 ease-out ${
              activeStep === index ? 'bg-primary' : 'bg-base-300'
            }`}
            onClick={() => handleClick(index)}
            aria-label={`View pinned message ${index + 1}`}
          />
        ))}
      </div>

      <div className="relative flex h-10 w-full flex-col text-sm">
        <span className="text-base-content font-bold">Pinned messages</span>
        {pinnedMessages.map((message, index) => (
          <div
            key={index}
            className="text-base-content/70 truncate text-wrap"
            style={{ display: activeStep === index ? 'block' : 'none' }}>
            {message.content}
          </div>
        ))}
      </div>

      <VscPinnedDirty size={24} className="text-base-content/50 m-2 rotate-45" />
    </div>
  )
}
