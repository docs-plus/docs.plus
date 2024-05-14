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
    <div className="relative  flex w-full items-center justify-start p-2">
      <div className="mr-2 flex h-12 flex-col overflow-hidden">
        {pinnedMessages.map((_, index) => (
          <button
            key={index}
            ref={(el) => {
              buttonsRef.current[index] = el
            }}
            className={`mb-1 flex-1 rounded-full p-[2px] py-2 transition-colors duration-200 ease-out ${
              activeStep === index ? 'bg-primary-content' : 'bg-secondary'
            }`}
            onClick={() => handleClick(index)}
          />
        ))}
      </div>

      <div className="relative  flex h-10 w-full flex-col text-sm">
        <span className="font-bold text-primary-content">Pinned messages</span>
        {pinnedMessages.map((message, index) => (
          <div
            key={index}
            className="truncate text-wrap"
            style={{ display: activeStep === index ? 'block' : 'none' }}>
            {message.content}
          </div>
        ))}
      </div>

      <VscPinnedDirty size={24} className="m-2 rotate-45" />
    </div>
  )
}
