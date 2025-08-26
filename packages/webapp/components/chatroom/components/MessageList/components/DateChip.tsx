import { format, parseISO } from 'date-fns'

type Props = {
  date: string
  isScrollingUp: boolean
}

export const DateChip = ({ date, isScrollingUp }: Props) => (
  <div
    className="date_chip relative z-10 my-2 flex w-full justify-center pt-2"
    style={{ position: isScrollingUp ? 'sticky' : 'relative', top: isScrollingUp ? 0 : undefined }}>
    <div className="badge bg-base-100 relative z-10">{format(parseISO(date), 'MMMM do, yyyy')}</div>
  </div>
)
