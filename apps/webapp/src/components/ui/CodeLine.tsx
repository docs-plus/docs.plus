import { twMerge } from '@utils/twMerge'

/** One line of code. A long line scrolls inside its own box, so a phone never scrolls the page sideways. */
export const CodeLine = ({ text, className }: { text: string; className?: string }) => (
  <code
    className={twMerge(
      'bg-base-200 border-base-300 rounded-field text-base-content overflow-x-auto border px-2 py-1.5 font-mono text-xs whitespace-nowrap',
      className
    )}>
    {text}
  </code>
)
