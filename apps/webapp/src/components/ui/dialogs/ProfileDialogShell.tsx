import CloseButton from '@components/ui/CloseButton'
import { ModalHeading } from '@components/ui/Dialog'
import { ScrollArea } from '@components/ui/ScrollArea'
import type { ReactNode } from 'react'

type ProfileDialogShellProps = {
  title: string
  onClose: () => void
  busy?: boolean
  message?: string
  header?: ReactNode
  children?: ReactNode
}

export function ProfileDialogShell({
  title,
  onClose,
  busy,
  message,
  header,
  children
}: ProfileDialogShellProps) {
  const closeButton = (
    <CloseButton onClick={onClose} className="shrink-0" aria-label="Close profile" />
  )

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      aria-busy={busy || undefined}
      data-testid="user-profile-dialog">
      <ModalHeading className="sr-only">{title}</ModalHeading>

      {message ? (
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-base-content text-lg font-semibold">{title}</p>
              <p className="text-base-content/60 mt-1 text-sm">{message}</p>
            </div>
            {closeButton}
          </div>
        </div>
      ) : (
        <>
          <div className="border-base-300 flex shrink-0 items-center gap-4 border-b px-4 py-4 sm:px-6 sm:py-5">
            {header}
            {closeButton}
          </div>
          <ScrollArea className="min-h-0 flex-1" scrollbarSize="thin" hideScrollbar={false}>
            {children}
          </ScrollArea>
        </>
      )}
    </div>
  )
}
