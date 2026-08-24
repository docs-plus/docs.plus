import GoogleOneTapAuth from '@components/GoogleOneTapAuth'

type Props = {
  children: React.ReactNode
  /**
   * Off on mobile. One Tap needs FedCM (Chromium). Every iOS browser is WebKit,
   * so the prompt never shows and the GSI script is wasted. On Android it drops
   * Google's sheet over the editor. The sign-in dialog covers mobile instead.
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
