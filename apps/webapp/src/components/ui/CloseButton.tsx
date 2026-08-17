import { Icons } from '@icons'

import Button from './Button'

export type CloseButtonSize = 'xs' | 'sm' | 'md'

interface CloseButtonProps {
  onClick: () => void
  size?: CloseButtonSize
  /** Overrides the Button size→glyph map (`sm` is 16). Docked pad controls pass 20. */
  iconSize?: number
  className?: string
  'aria-label'?: string
}

/** Hover and pressed fills come from daisyUI's own btn-ghost. It resolves to an opaque
 * base-300 — theme-tracked, and identical on base-100 headers and base-200 clusters.
 * No per-ground override is needed. */
const CloseButton = ({
  onClick,
  size = 'sm',
  iconSize,
  className = '',
  'aria-label': ariaLabel = 'Close'
}: CloseButtonProps) => {
  return (
    <Button
      onClick={onClick}
      variant="ghost"
      size={size}
      shape="square"
      iconSize={iconSize}
      startIcon={Icons.close}
      className={`text-base-content/70 hover:text-base-content focus-visible:ring-primary focus-visible:ring-2 focus-visible:outline-none ${className}`}
      aria-label={ariaLabel}
    />
  )
}

CloseButton.displayName = 'CloseButton'

export default CloseButton
