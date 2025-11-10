type Props = {
  index: number
}

export const UnreadIndicatorLine = ({ index }: Props) => {
  return (
    <div key={`unread-${index}`} className="divider my-2 w-full p-4">
      Unread messages
    </div>
  )
}
