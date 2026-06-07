import { format, parseISO } from 'date-fns'
import { twMerge } from 'tailwind-merge'

type DayProps = {
  variant: 'day'
  date: string
  className?: string
  floating?: boolean
}

type UnreadProps = {
  variant: 'unread'
  className?: string
}

type Props = DayProps | UnreadProps

function formatFeedDayLabel(isoDate: string) {
  return format(parseISO(isoDate), 'd MMM yyyy')
}

export function FeedSeparator(props: Props) {
  if (props.variant === 'unread') {
    return (
      <div
        role="separator"
        aria-label="New messages"
        className={twMerge(
          'feed-separator feed-separator--unread flex w-full items-center gap-3 px-4 py-2',
          props.className
        )}>
        <span className="bg-error/40 h-px flex-1" aria-hidden />
        <span className="text-error/90 shrink-0 text-xs font-semibold">New messages</span>
        <span className="badge badge-error badge-xs shrink-0 font-bold uppercase">New</span>
        <span className="bg-error/40 h-px flex-1" aria-hidden />
      </div>
    )
  }

  const { date, className, floating } = props
  return (
    <div
      className={twMerge(
        'date_chip feed-separator feed-separator--day flex w-full items-center gap-3 px-4 py-2',
        floating && 'pointer-events-none',
        className
      )}
      {...(floating ? {} : { 'data-msg-date': date })}>
      <span className="bg-base-300/80 h-px flex-1" aria-hidden />
      <span className="text-base-content/50 shrink-0 text-xs font-semibold">
        {formatFeedDayLabel(date)}
      </span>
      <span className="bg-base-300/80 h-px flex-1" aria-hidden />
    </div>
  )
}
