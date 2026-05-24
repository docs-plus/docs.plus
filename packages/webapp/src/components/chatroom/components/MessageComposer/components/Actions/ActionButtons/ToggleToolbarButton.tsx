import { Icons } from '@icons'
import { twMerge } from 'tailwind-merge'

import { useMessageComposer } from '../../../hooks/useMessageComposer'
import Button from '../../ui/Button'

interface Props extends React.ComponentProps<typeof Button> {
  size?: number
}

export const ToggleToolbarButton = ({ className, size = 18, ...props }: Props) => {
  const { showFormattingToolbar, toggleToolbar } = useMessageComposer()
  const label = showFormattingToolbar ? 'Hide formatting' : 'Show formatting'

  return (
    <Button
      className={twMerge(
        'size-9 min-h-0 min-w-9 shrink-0 rounded-lg border-0 p-0 sm:size-8 sm:min-h-0 sm:min-w-8',
        className
      )}
      onPress={toggleToolbar}
      tooltip={label}
      tooltipPosition="top"
      isActive={showFormattingToolbar}
      aria-pressed={showFormattingToolbar}
      aria-label={label}
      {...props}>
      <Icons.textFormat
        size={size}
        className={twMerge(
          'pointer-events-none shrink-0 stroke-[1.75]',
          showFormattingToolbar && 'text-primary'
        )}
      />
    </Button>
  )
}
