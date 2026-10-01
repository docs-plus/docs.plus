import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useMediaDisplayUrl } from '@components/chatroom/hooks/useMediaSignedUrl'
import type { ComposerAttachment } from '@components/chatroom/stores/composerAttachmentsStore'
import { inferMessageMediaKind } from '@components/chatroom/utils/messageMediaPaths'
import { Icons } from '@icons'
import { useStore } from '@stores'
import { twMerge } from '@utils/twMerge'
import { type CSSProperties, useEffect, useState } from 'react'

import { useComposerAttachmentActions, useComposerAttachmentList } from '../../hooks'

const MediaIcon = ({ kind }: { kind: ReturnType<typeof inferMessageMediaKind> | null }) => {
  if (kind === 'video') return <Icons.video size={16} className="shrink-0 stroke-[1.75]" />
  if (kind === 'audio') return <Icons.music size={16} className="shrink-0 stroke-[1.75]" />
  if (kind === 'file') return <Icons.fileText size={16} className="shrink-0 stroke-[1.75]" />
  return <Icons.image size={16} className="shrink-0 stroke-[1.75]" />
}

function UploadProgressRing({
  progress,
  label,
  className
}: {
  progress: number
  label: string
  className?: string
}) {
  return (
    <div
      className={twMerge(
        'radial-progress text-primary bg-base-100/85 pointer-events-none absolute inset-0 m-auto text-[8px] font-semibold tabular-nums',
        className
      )}
      style={
        {
          '--value': progress,
          '--size': '2rem',
          '--thickness': '3px'
        } as CSSProperties
      }
      role="progressbar"
      aria-label={`Uploading ${label}`}
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}>
      {/* Hidden so each percent step changes no readable text in the strip's live region. */}
      <span aria-hidden="true">{progress}%</span>
    </div>
  )
}

const AttachmentChip = ({
  attachment,
  compact
}: {
  attachment: ComposerAttachment
  compact?: boolean
}) => {
  const { removeAttachment, retryAttachment, toggleAttachmentSpoiler } =
    useComposerAttachmentActions()
  const signedPreviewUrl = useMediaDisplayUrl(
    attachment.status === 'ready' && attachment.item?.type === 'image' ? attachment.item : null
  )
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const previewUrl = signedPreviewUrl ?? blobUrl
  const isUploading = attachment.status === 'uploading'
  const isError = attachment.status === 'error'
  const canRetry = isError && !attachment.tooLarge
  // A restored row whose upload is gone. It has no file, so it offers Remove but no Retry.
  const isExpired = attachment.status === 'expired'
  const showsError = isError || isExpired
  const errorLabel = isExpired ? 'Upload expired' : attachment.error
  const progress = attachment.progress ?? 0

  // Local image preview while uploading. Keyed on the stable File so per-tick progress
  // updates (each a new attachment object) don't recreate and revoke the object URL.
  const file = attachment.file
  useEffect(() => {
    if (!file || inferMessageMediaKind(file) !== 'image') {
      setBlobUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setBlobUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const label = attachment.item?.name ?? attachment.file?.name ?? 'Attachment'
  const kind =
    attachment.item?.type ?? (attachment.file ? inferMessageMediaKind(attachment.file) : null)
  const canSpoiler = kind === 'image'

  let fullPlaceholderIcon: React.ReactNode = null
  if (!isUploading) {
    if (showsError) {
      fullPlaceholderIcon = <Icons.alert size={16} className="text-error shrink-0 stroke-[1.75]" />
    } else {
      fullPlaceholderIcon = <MediaIcon kind={kind} />
    }
  }

  let statusLine: React.ReactNode = null
  if (isUploading) {
    statusLine = <p className="text-base-content/60 text-[10px] tabular-nums">Uploading…</p>
  } else if (isError) {
    statusLine = (
      <p className="text-error line-clamp-2 text-[10px]" title={attachment.error}>
        {attachment.error ?? 'Upload failed'}
      </p>
    )
  } else if (isExpired) {
    statusLine = <p className="text-error text-[10px]">{errorLabel}</p>
  } else if (attachment.status === 'ready') {
    statusLine = <p className="text-base-content/60 text-[10px]">Ready to send</p>
  }

  if (compact) {
    return (
      // Remove sits beside the tile, not on it, so its 44 px target never overlaps full-tile Retry.
      <div
        className={twMerge(
          'rounded-field flex shrink-0 items-center',
          showsError && 'ring-error/50 ring-1'
        )}>
        <div className="relative size-11 shrink-0">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt=""
              className={twMerge(
                'rounded-field size-full object-cover',
                isUploading && 'opacity-45',
                attachment.spoiler && 'blur-sm'
              )}
            />
          ) : (
            <div
              className={twMerge(
                'bg-base-200 rounded-field flex size-full items-center justify-center',
                showsError && 'bg-error/10'
              )}>
              {showsError ? null : <MediaIcon kind={kind} />}
            </div>
          )}
          {isUploading ? <UploadProgressRing progress={progress} label={label} /> : null}
          {/* Only this overlay draws the alert, so glyphs never stack. Retry has its own glyph. */}
          {showsError && !canRetry ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Icons.alert
                size={14}
                className="text-error shrink-0 stroke-[1.75]"
                title={errorLabel}
                aria-label={errorLabel}
              />
            </div>
          ) : null}
          {canRetry ? (
            <button
              type="button"
              className="focus-visible:ring-primary rounded-field absolute inset-0 flex items-center justify-center focus-visible:ring-2 focus-visible:outline-none"
              aria-label={`Retry upload for ${label}`}
              title={attachment.error ?? 'Retry upload'}
              onClick={() => retryAttachment(attachment.id)}>
              <Icons.sync size={14} className="text-error shrink-0 stroke-[1.75]" />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-square size-11 min-h-11 min-w-11 shrink-0"
          aria-label={`Remove ${label}`}
          onClick={() => removeAttachment(attachment.id)}>
          <Icons.close size={14} className="stroke-[1.75]" />
        </button>
      </div>
    )
  }

  return (
    <div
      className={twMerge(
        'bg-base-100 border-base-300 rounded-field flex max-w-[14rem] min-w-[10rem] flex-col gap-1.5 border px-2 py-1.5',
        showsError && 'border-error/50 bg-error/5'
      )}>
      <div className="flex items-center gap-2">
        <div className="relative size-8 shrink-0">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt=""
              className={twMerge(
                'rounded-field size-full object-cover',
                isUploading && 'opacity-45',
                showsError && 'opacity-60'
              )}
            />
          ) : (
            <div
              className={twMerge(
                'bg-base-200 rounded-field flex size-8 items-center justify-center',
                showsError && 'bg-error/10'
              )}>
              {fullPlaceholderIcon}
            </div>
          )}
          {isUploading ? <UploadProgressRing progress={progress} label={label} /> : null}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{label}</p>
          {statusLine}
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-xs btn-square h-6 min-h-0 w-6 shrink-0"
          aria-label={`Remove ${label}`}
          onClick={() => removeAttachment(attachment.id)}>
          <Icons.close size={14} className="stroke-[1.75]" />
        </button>
      </div>

      {canSpoiler ? (
        <button
          type="button"
          data-testid="attachment-spoiler-toggle"
          className={twMerge(
            'btn btn-ghost btn-xs h-6 min-h-0 gap-1 px-1.5 text-[10px] font-medium',
            attachment.spoiler && 'text-primary bg-primary/10'
          )}
          aria-pressed={Boolean(attachment.spoiler)}
          aria-label={attachment.spoiler ? 'Remove spoiler blur' : 'Mark image as spoiler'}
          onClick={() => toggleAttachmentSpoiler(attachment.id)}>
          <Icons.eye size={12} className="shrink-0 stroke-[1.75]" aria-hidden />
          {attachment.spoiler ? 'Spoiler on' : 'Spoiler'}
        </button>
      ) : null}

      {isUploading ? (
        <div className="bg-base-300 h-1 w-full overflow-hidden rounded-full" aria-hidden>
          <div
            className="bg-primary h-full duration-150 ease-out motion-safe:transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}

      {/* The status line already states the failure, so this row is only the action. */}
      {canRetry ? (
        <button
          type="button"
          className="btn btn-ghost btn-xs text-error focus-visible:ring-primary h-6 min-h-0 gap-1 self-start px-1.5 text-[10px] font-medium focus-visible:ring-2 focus-visible:outline-none"
          aria-label={`Retry upload for ${label}`}
          title={attachment.error ?? 'Retry upload'}
          onClick={() => retryAttachment(attachment.id)}>
          <Icons.sync size={12} className="shrink-0 stroke-[1.75]" aria-hidden />
          Retry
        </button>
      ) : null}
    </div>
  )
}

export const AttachmentStrip = ({
  className,
  compact = false
}: {
  className?: string
  compact?: boolean
}) => {
  const { channelId } = useChatroomContext()
  const workspaceId = useStore((state) => state.settings.workspaceId)
  const attachments = useComposerAttachmentList(workspaceId, channelId)

  if (attachments.length === 0) return null

  return (
    <div
      className={twMerge(
        compact
          ? 'border-base-300/60 hide-scrollbar flex gap-1.5 overflow-x-auto border-b px-2 py-1.5'
          : 'border-base-300/60 flex flex-wrap gap-2 border-b px-3 py-2',
        className
      )}
      aria-live="polite"
      aria-relevant="additions text">
      {attachments.map((attachment) => (
        <AttachmentChip key={attachment.id} attachment={attachment} compact={compact} />
      ))}
    </div>
  )
}
