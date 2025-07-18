import GoogleOneTapAuth from '@components/GoogleOneTapAuth'

type Props = {
  children: React.ReactNode
}
export default function GoogleOneTapLayout({ children }: Props) {
  return (
    <div className="h-full">
      {children}
      {/* <GoogleOneTapAuth /> */}
    </div>
  )
}
