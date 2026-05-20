import Button from '@components/ui/Button'
import { useAuthStore } from '@stores'
import { format, parseISO } from 'date-fns'

export type NewMessagesBannerProps = {
  count: number
  sinceIso?: string | null
  onMarkAsRead: () => void
}

function formatBannerLabel(count: number, sinceIso: string | null | undefined) {
  const countLabel =
    count > 99 ? '99+ new messages' : count === 1 ? '1 new message' : `${count} new messages`

  if (!sinceIso) return countLabel

  try {
    return `${countLabel} since ${format(parseISO(sinceIso), 'h:mm a')}`
  } catch {
    return countLabel
  }
}

export const NewMessagesBanner = ({ count, sinceIso, onMarkAsRead }: NewMessagesBannerProps) => {
  const isAuthed = !!useAuthStore((state) => state.profile?.id)
  if (!isAuthed || count <= 0) return null

  return (
    <div
      className="border-base-300/80 bg-primary text-primary-content relative z-30 flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2 text-sm"
      role="status"
      aria-live="polite">
      <span className="min-w-0 truncate font-medium">{formatBannerLabel(count, sinceIso)}</span>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="text-primary-content hover:bg-primary-content/15 shrink-0"
        onClick={onMarkAsRead}>
        Mark as read
      </Button>
    </div>
  )
}
