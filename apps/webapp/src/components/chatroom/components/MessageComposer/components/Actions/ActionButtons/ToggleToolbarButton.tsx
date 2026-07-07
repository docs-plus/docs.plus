import { Icons } from '@icons'
import { twMerge } from 'tailwind-merge'

import { useMessageComposer } from '../../../hooks/useMessageComposer'
import Button from '../../ui/Button'

type Props = React.ComponentProps<typeof Button> & {
  size?: number
}

export const ToggleToolbarButton = ({ className, size = 18, ...props }: Props) => {
  const { showFormattingToolbar, toggleToolbar, isMobile } = useMessageComposer()
  const label = showFormattingToolbar ? 'Hide formatting' : 'Show formatting'

  return (
    <Button
      className={twMerge(
        isMobile
          ? 'rounded-field size-11 min-h-11 min-w-11 shrink-0 border-0 p-0'
          : 'rounded-field size-8 min-h-8 min-w-8 shrink-0 border-0 p-0',
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
