import { twMerge } from '@utils/twMerge'

/** A text bone inside a line box of the real line height, so the swap moves no pixel. */
export const TextLine = ({
  box = 'h-5',
  bone,
  className
}: {
  box?: string
  bone: string
  className?: string
}) => (
  <div className={twMerge('flex items-center', box, className)}>
    <div className={`skeleton ${bone}`} />
  </div>
)
