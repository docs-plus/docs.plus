import { getWorkspaceMemberLastLeft } from '@api'
import * as toast from '@components/toast'
import { useStore } from '@stores'

/** The newest View owns the slot, whatever order the two reads land in. */
let armToken = 0

/**
 * Last left is the only instant that means "before I left": the carrier's own
 * `created_at` sits after the edit that minted it. Clear and set live here, so
 * no caller carries an ordering rule. Detached from the click, so navigation is
 * never blocked — `useArmPendingHistoryCompare` waits for the History list.
 */
export async function armCompareFromLastLeft(
  documentId: string | null,
  memberId?: string
): Promise<void> {
  const token = ++armToken
  // Synchronous, before the read below: a value left by an earlier View would
  // otherwise arm the wrong window while this one is still in flight.
  useStore.getState().setPendingCompareSince(null)

  // `channel_id` IS the documentId on a carrier row. Do not parse `action_url`.
  if (!documentId) return
  // No signed-in reader means no membership row to read, and "no earlier visit"
  // would name the wrong reason. Open History with no compare and stay quiet.
  if (!memberId) return

  const { data, error } = await getWorkspaceMemberLastLeft({ documentId, memberId })
  // A second View started while this read was open, and it names another
  // document. Neither its toast nor its instant belongs to that reader now.
  if (token !== armToken) return
  // Error first: a transport failure also leaves `data` null, and a failed read
  // is not the same fact as this reader having no earlier visit.
  if (error) return

  const lastLeft = data?.last_connection_closed_at
  if (!lastLeft) {
    toast.Info('No earlier visit to compare against.')
    return
  }
  useStore.getState().setPendingCompareSince(lastLeft)
}
