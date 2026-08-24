import { SheetLayout } from '@components/SheetLayout'
import { type SheetDataMap, useSheetStore } from '@stores'
import { sheetBodyPadClassName } from '@utils/sheetBodyPadding'

import SignInForm from './SignInForm'

/** Phone sign-in body. `Sheet.Header` already draws the grabber. */
export default function SignInSheet({ data }: { data: SheetDataMap['signIn'] }) {
  const closeSheet = useSheetStore((state) => state.closeSheet)

  return (
    <SheetLayout title="Sign in" onClose={closeSheet}>
      <div className={`py-3 ${sheetBodyPadClassName}`}>
        <SignInForm returnTo={data.returnTo} onClose={closeSheet} embedded />
      </div>
    </SheetLayout>
  )
}
