import { type SheetDataMap, useSheetStore } from '@stores'

import SignInForm from './SignInForm'

/** Phone sign-in body. `Sheet.Header` already draws the grabber. */
export default function SignInSheet({ data }: { data: SheetDataMap['signIn'] }) {
  const closeSheet = useSheetStore((state) => state.closeSheet)

  return (
    <div className="w-full px-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
      <SignInForm returnTo={data.returnTo} onClose={closeSheet} />
    </div>
  )
}
