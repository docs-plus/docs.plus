import { SheetLayout } from '@components/SheetLayout'
import { type SheetDataMap, useSheetStore } from '@stores'

import SlashMenuList from './SlashMenuList'

/** Phone host. The sheet opts out of the focus trap, so the editor keeps focus and the keyboard. */
export default function SlashMenuSheet({ data }: { data: SheetDataMap['slashMenu'] }) {
  const closeSheet = useSheetStore((s) => s.closeSheet)

  return (
    <SheetLayout title="Insert block" onClose={closeSheet}>
      <SlashMenuList editor={data.editor} className="px-2" />
    </SheetLayout>
  )
}
