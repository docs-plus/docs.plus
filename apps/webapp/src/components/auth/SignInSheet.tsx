import { SheetLayout } from '@components/SheetLayout'
import { type SheetDataMap, useSheetStore } from '@stores'
import { sheetBodyPadClassName } from '@utils/sheetBodyPadding'

import SignInForm from './SignInForm'

/** Phone sign-in body. `Sheet.Header` already draws the grabber; a sheet has no footer strip. */
export default function SignInSheet({ data }: { data: SheetDataMap['signIn'] }) {
  const closeSheet = useSheetStore((state) => state.closeSheet)

  return (
    <SignInForm returnTo={data.returnTo} touch>
      {({ sent, title, description, body, back }) => (
        <SheetLayout title={title} onClose={closeSheet}>
          <div className={`flex flex-col gap-4 py-4 ${sheetBodyPadClassName}`}>
            {description ? (
              <p className="text-base-content/70 text-sm" role={sent ? 'status' : undefined}>
                {description}
              </p>
            ) : null}
            {body}
            {back ? <div className="self-start">{back}</div> : null}
          </div>
        </SheetLayout>
      )}
    </SignInForm>
  )
}
