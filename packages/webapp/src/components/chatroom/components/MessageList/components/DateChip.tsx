import { format, parseISO } from 'date-fns'

type Props = {
  date: string
}

export const DateChip = ({ date }: Props) => (
  <div className={`date_chip z-10 my-2 flex w-full justify-center pt-2`}>
    <div className="badge bg-base-100 relative z-10">{format(parseISO(date), 'MMMM do, yyyy')}</div>
  </div>
)
