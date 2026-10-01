import { useId, useState } from 'react'
import { MdCloudUpload } from 'react-icons/md'

import {
  formatMediaMaxUploadSize,
  MEDIA_MAX_UPLOAD_BYTES,
  mediaUploadLimitExceededMessage
} from './mediaUploadLimits'

const ACCEPTED_PREFIXES = ['image/', 'video/', 'audio/']

export interface MediaUploadDropzoneProps {
  onFile: (file: File) => void
}

const isAcceptedMedia = (file: File): boolean =>
  ACCEPTED_PREFIXES.some((prefix) => file.type.startsWith(prefix))

const MediaUploadDropzone = ({ onFile }: MediaUploadDropzoneProps) => {
  const inputId = useId()
  const [isDragOver, setIsDragOver] = useState(false)
  const [invalid, setInvalid] = useState<string | null>(null)

  const accept = (file: File | undefined) => {
    if (!file) return
    if (!isAcceptedMedia(file)) {
      setInvalid('Only image, video, or audio files are supported.')
      return
    }
    if (file.size > MEDIA_MAX_UPLOAD_BYTES) {
      setInvalid(mediaUploadLimitExceededMessage())
      return
    }
    setInvalid(null)
    onFile(file)
  }

  let stateClass = 'border-base-300 bg-base-200 hover:bg-base-300'
  if (invalid) stateClass = 'border-error bg-error/5'
  else if (isDragOver) stateClass = 'border-primary bg-primary/5'

  return (
    <div className="flex w-full items-center justify-center">
      <label
        htmlFor={inputId}
        className={`rounded-box has-[:focus-visible]:ring-primary relative flex h-36 w-full cursor-pointer flex-col items-center justify-center border-2 border-dashed transition-colors has-[:focus-visible]:ring-2 ${stateClass}`}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsDragOver(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsDragOver(false)
          accept(e.dataTransfer.files[0])
        }}>
        <MdCloudUpload
          size={30}
          className={`mb-2 ${isDragOver ? 'text-primary' : 'text-base-content/50'}`}
        />
        {/* Both lines sit above /60: that step drops under 4.5:1 on the base-300 hover fill. */}
        <p className="text-base-content text-sm">
          <span className="font-semibold">Click to upload</span> or drag and drop
        </p>
        <p className={`text-xs ${invalid ? 'text-[var(--error-ink)]' : 'text-base-content/70'}`}>
          {invalid ?? `Image, video, or audio (max ${formatMediaMaxUploadSize()})`}
        </p>
        {/* `sr-only`, not `hidden`: the input stays in the Tab order and opens on Enter or Space. */}
        <input
          id={inputId}
          type="file"
          className="sr-only"
          accept="image/*,video/*,audio/*"
          onChange={(e) => accept(e.target.files?.[0])}
        />
      </label>
    </div>
  )
}

export default MediaUploadDropzone
