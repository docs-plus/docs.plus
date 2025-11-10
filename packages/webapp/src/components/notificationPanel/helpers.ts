import { formatDistanceToNow } from 'date-fns'

export const formatTimeAgo = (date: string) => {
  return formatDistanceToNow(new Date(date), { addSuffix: false })
}
