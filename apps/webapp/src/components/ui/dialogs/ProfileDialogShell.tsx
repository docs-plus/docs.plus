import { ModalBody, ModalClose, ModalDescription, ModalHeading } from '@components/ui/Dialog'
import { ScrollArea } from '@components/ui/ScrollArea'
import type { ReactNode } from 'react'

type ProfileDialogShellProps = {
  title: string
  busy?: boolean
  message?: string
  header?: ReactNode
  /** The header renders the visible `ModalHeading`, so the shell skips its screen-reader copy. */
  titleInHeader?: boolean
  children?: ReactNode
}

export function ProfileDialogShell({
  title,
  busy,
  message,
  header,
  titleInHeader = false,
  children
}: ProfileDialogShellProps) {
  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      aria-busy={busy || undefined}
      data-testid="user-profile-dialog">
      {/* First in the DOM so the focus manager lands on it, not on a profile link. */}
      <ModalClose className="z-10" aria-label="Close profile" />

      {message ? (
        <ModalBody>
          <div className="flex flex-col gap-1 pr-10">
            <ModalHeading>{title}</ModalHeading>
            <ModalDescription>{message}</ModalDescription>
          </div>
          {children}
        </ModalBody>
      ) : (
        <>
          {!titleInHeader && <ModalHeading className="sr-only">{title}</ModalHeading>}
          <div className="border-base-300 flex shrink-0 items-center gap-4 border-b p-6 pr-16">
            {header}
          </div>
          <ScrollArea className="min-h-0 flex-1" scrollbarSize="thin" hideScrollbar={false}>
            {children}
          </ScrollArea>
        </>
      )}
    </div>
  )
}
