import GoogleOneTapAuth from '@components/GoogleOneTapAuth'

type Props = {
  children: React.ReactNode
}
export default function GoogleOneTapLayout({ children }: Props) {
  return (
    // <div className="h-auto overflow-auto ">
    //   {children}
    //   {/* <GoogleOneTapAuth /> */}
    // </div>
    <>{children}</>
  )
}
