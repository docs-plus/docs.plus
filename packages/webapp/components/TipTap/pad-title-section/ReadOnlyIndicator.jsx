import { useEffect, useState } from 'react'
import { PenSlash } from '@icons'
import { twMerge } from 'tailwind-merge'
import { useDocumentMetadataContext } from '@context/DocumentMetadataContext'
import { useStore } from '@stores'

const ReadOnlyIndicator = ({ className }) => {
  const docMetadata = useDocumentMetadataContext()
  const [isReadOnly, setIsReadOnly] = useState(docMetadata.readOnly)
  const { hocuspocusProvider } = useStore((state) => state.settings)

  useEffect(() => {
    if (!hocuspocusProvider) return

    const readOnlyStateHandler = ({ payload }) => {
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

  return (
    <>
      {isReadOnly && (
        <div className={classes}>
          <PenSlash size={13} fill="#ccc" />
          <p className="font-bold sm:flex hidden ml-3 text-xs antialiased">Read-only</p>
        </div>
      )}
    </>
  )
}

export default ReadOnlyIndicator
