import { useEffect, useState } from 'react'
import { PenSlash } from '@icons'
import { twMerge } from 'tailwind-merge'
import { useStore } from '@stores'

const ReadOnlyIndicator = ({ className }: any) => {
  const { hocuspocusProvider, metadata } = useStore((state) => state.settings)
  const [isReadOnly, setIsReadOnly] = useState(metadata.readOnly)

  useEffect(() => {
    if (!hocuspocusProvider) return

    const readOnlyStateHandler = ({ payload }: any) => {
      const msg = JSON.parse(payload)
      if (msg.type === 'readOnly') setIsReadOnly(msg.state)
    }

    hocuspocusProvider.on('stateless', readOnlyStateHandler)

    return () => hocuspocusProvider.off('stateless', readOnlyStateHandler)
  }, [hocuspocusProvider])

  const classes = twMerge(
    'rounded-md p-2 ml-4 hover:border-docsy transition-all hover:drop-shadow-md flex align-middle items-center justify-center border text-gray-500',
    className
  )

  if (!isReadOnly) return null

  return (
    <>
      <div className={classes}>
        <PenSlash size={13} fill="#ccc" />
        <p className="font-bold sm:flex hidden ml-3 text-xs antialiased">Read-only</p>
      </div>
    </>
  )
}

export default ReadOnlyIndicator
