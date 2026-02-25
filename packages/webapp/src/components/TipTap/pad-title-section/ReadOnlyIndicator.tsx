import { Icons } from '@icons'
import { useStore } from '@stores'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface ReadOnlyIndicatorProps {
  className?: string
}

interface StatelessPayloadEvent {
  payload: string
}

const ReadOnlyIndicator = ({ className }: ReadOnlyIndicatorProps) => {
  const { hocuspocusProvider, metadata } = useStore((state) => state.settings)
  const [isReadOnly, setIsReadOnly] = useState(metadata?.readOnly)

  useEffect(() => {
    if (!hocuspocusProvider) return

    const readOnlyStateHandler = ({ payload }: StatelessPayloadEvent) => {
      try {
        const msg = JSON.parse(payload)
        if (msg.type === 'readOnly') setIsReadOnly(Boolean(msg.state))
      } catch {
        // Ignore malformed payloads.
      }
    }

    hocuspocusProvider.on('stateless', readOnlyStateHandler)

    return () => hocuspocusProvider.off('stateless', readOnlyStateHandler)
  }, [hocuspocusProvider])

  const classes = twMerge(
    'rounded-md p-2 ml-4 hover:border-primary transition-all hover:drop-shadow-md flex align-middle items-center justify-center border text-base-content/50',
    className
  )

  if (!isReadOnly) return null

  return (
    <>
      <div className={classes}>
        <Icons.penOff size={13} className="text-base-content/40" />
        <p className="ml-3 hidden text-xs font-bold antialiased sm:flex">Read-only</p>
      </div>
    </>
  )
}

export default ReadOnlyIndicator
