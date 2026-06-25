import { ChatMediaGallery } from '@components/chatroom/components/ChatMediaGallery'
import { FloatingTree } from '@floating-ui/react'
import { VirtuosoMessageListLicense } from '@virtuoso.dev/message-list'
import { ReactNode } from 'react'

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
