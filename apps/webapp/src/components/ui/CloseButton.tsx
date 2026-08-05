import { Icons } from '@icons'

import Button from './Button'

export type CloseButtonSize = 'xs' | 'sm' | 'md'

interface CloseButtonProps {
  onClick: () => void
  size?: CloseButtonSize
  className?: string
  'aria-label'?: string
}

/** base-content mix, not bg-base-300 — reads on both bg-base-100 headers and
 * bg-base-200 chat clusters across all seven themes. */
const CloseButton = ({
  onClick,
  size = 'sm',
  className = '',
  'aria-label': ariaLabel = 'Close'
}: CloseButtonProps) => {
  return (
    <Button
      onClick={onClick}
      variant="ghost"
      size={size}
      shape="square"
      startIcon={Icons.close}
      className={`text-base-content/70 hover:text-base-content focus-visible:ring-primary hover:bg-[color-mix(in_oklch,var(--color-base-content)_10%,transparent)] focus-visible:ring-2 focus-visible:outline-none active:bg-[color-mix(in_oklch,var(--color-base-content)_16%,transparent)] ${className}`}
      aria-label={ariaLabel}
    />
  )
}

CloseButton.displayName = 'CloseButton'

export default CloseButton
