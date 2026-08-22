import GoogleOneTapAuth from '@components/GoogleOneTapAuth'

type Props = {
  children: React.ReactNode
  /**
   * Off on mobile. One Tap needs FedCM, which is Chromium-only, and every iOS
   * browser is WebKit — so the prompt cannot display there at all, and the GSI
   * script downloads for nothing. On Android it works, but drops Google's bottom
   * sheet over the editor uninvited. The sign-in dialog covers mobile instead.
   */
  enabled?: boolean
}

export default function GoogleOneTapLayout({ children, enabled = true }: Props) {
  return (
    <>
      {children}
      {enabled && <GoogleOneTapAuth />}
    </>
  )
}
