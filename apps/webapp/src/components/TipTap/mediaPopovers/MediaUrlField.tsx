import Button from '@components/ui/Button'
import TextInput from '@components/ui/TextInput'
import type { MediaNodeType } from '@docs.plus/extension-hypermultimedia'
import { forwardRef } from 'react'

import { MEDIA_INSERT_REGISTRY } from './mediaInsert'
import MediaUrlPreview from './MediaUrlPreview'

export interface MediaUrlFieldProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  /** Detected node type, or null while the field is empty. */
  detectedType: MediaNodeType | null
  /** Insert is in-flight (image dimension preload). */
  loading?: boolean
}

/** URL entry with a live detected-type chip + Insert, over an inline preview. */
const MediaUrlField = forwardRef<HTMLInputElement, MediaUrlFieldProps>(
  ({ value, onChange, onSubmit, detectedType, loading }, ref) => {
    const entry = detectedType ? MEDIA_INSERT_REGISTRY[detectedType] : null
    const Icon = entry?.Icon

    return (
      <form
        className="flex flex-col gap-1"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}>
        <div className="join w-full">
          <TextInput
            ref={ref}
            type="url"
            aria-label="Media URL"
            placeholder="Paste a link to an image, video, or embed…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            startIcon={Icon ? <Icon size={18} /> : undefined}
            wrapperClassName="flex-1"
            containerClassName="join-item rounded-r-none"
          />
          <Button
            variant="primary"
            type="submit"
            className="join-item"
            loading={loading}
            disabled={!value.trim()}>
            Insert
          </Button>
        </div>
        {entry && (
          <p className="text-base-content/50 px-1 text-xs">
            Detected: <span className="text-base-content/70 font-medium">{entry.label}</span>
          </p>
        )}
        <MediaUrlPreview detectedType={detectedType} value={value} />
      </form>
    )
  }
)

MediaUrlField.displayName = 'MediaUrlField'

export default MediaUrlField
