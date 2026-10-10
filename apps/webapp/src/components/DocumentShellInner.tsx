import { FloatingTree } from '@floating-ui/react'
import dynamic from 'next/dynamic'
import { ReactNode } from 'react'

// The gallery is closed at load, so its code loads after hydration. Accepted gap: it has no
// loader, so a failed chunk leaves the gallery unopenable. An error card here would show on
// every pad.
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
      <FloatingTree>{children}</FloatingTree>
    </>
  )
}
