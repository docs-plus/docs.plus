import { FloatingTree } from '@floating-ui/react'
import { VirtuosoMessageListLicense } from '@virtuoso.dev/message-list'
import dynamic from 'next/dynamic'
import { ReactNode } from 'react'

// The shell hydrates from the server HTML, so its chunk blocks hydration. The gallery
// is closed at load, so its code loads after hydration. Accepted gap: it has no loader, so a
// failed chunk leaves the gallery unopenable. An error card here would show on every pad.
const ChatMediaGallery = dynamic(
  () =>
    import('@components/chatroom/components/ChatMediaGallery').then(
      (module) => module.ChatMediaGallery
    ),
  { ssr: false }
)

export function DocumentShellInner({ children }: { children: ReactNode }) {
  return (
    <>
      <ChatMediaGallery />
      <VirtuosoMessageListLicense licenseKey={process.env.NEXT_PUBLIC_VIRTUOSO_LICENSE ?? ''}>
        <FloatingTree>{children}</FloatingTree>
      </VirtuosoMessageListLicense>
    </>
  )
}
