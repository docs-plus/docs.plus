import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

import { useMessageCardContext } from '../../../MessageCardContext'

type Props = {
  className?: string
}
export const Username = ({ className }: Props) => {
  const { message } = useMessageCardContext()
  const displayName = useMemo(() => {
    const ud = message.user_details
    // Repo convention is `fullname` (single word) — see BookmarkItem,
    // ReplyContext, EditContext, types/api.ts. `full_name`/`display_name`
    // are kept as legacy fallbacks for any payload that still uses them.
    return ud?.fullname || ud?.display_name || ud?.full_name || ud?.username || ud?.email
    // Granular sub-field deps avoid recomputing on every parent payload
    // re-reference; the linter wants the parent `message.user_details`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    message.user_details?.fullname,
    message.user_details?.display_name,
    message.user_details?.username,
    message.user_details?.full_name
  ])
  return <span className={twMerge('text-xs font-bold', className)}>{displayName}</span>
}
