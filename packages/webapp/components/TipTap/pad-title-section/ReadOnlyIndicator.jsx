import { useEffect, useState } from 'react'
import { useEditorStateContext } from '@context/EditorContext'
import { PenSlash } from '@icons'
import { twMerge } from 'tailwind-merge'

const ReadOnlyIndicator = ({ docMetadata, className }) => {
  const [isReadOnly, setIsReadOnly] = useState(docMetadata.readOnly)
  const { EditorProvider } = useEditorStateContext()

  useEffect(() => {
    if (!EditorProvider) return

    const readOnlyStateHandler = ({ payload }) => {
      const msg = JSON.parse(payload)
      if (msg.type === 'readOnly') setIsReadOnly(msg.state)
    }

    EditorProvider.on('stateless', readOnlyStateHandler)

    return () => EditorProvider.off('stateless', readOnlyStateHandler)
  }, [EditorProvider])

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