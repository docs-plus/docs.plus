import { twMerge } from 'tailwind-merge'
import AddReactionButton from './components/AddReactionButton'
import ReactionList from './components/ReactionList'

type Props = {
  className?: string
  children?: React.ReactNode
}
const MessageReactions = ({ className, children }: Props) => {
  return (
    <div
      className={twMerge(
        'relative mr-auto flex w-full scroll-pl-6 flex-row flex-wrap justify-start gap-0.5 overflow-hidden overflow-x-auto',
        className
      )}>
      {children}
    </div>
  )
}

export default MessageReactions
MessageReactions.AddReactionButton = AddReactionButton
MessageReactions.ReactionList = ReactionList
