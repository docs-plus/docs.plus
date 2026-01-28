/**
 * CopyButton Component (Design System Docs)
 * ==========================================
 * Re-exports the shared CopyButton for design system documentation.
 * Uses inline feedback only (no toast) for cleaner docs experience.
 */

import SharedCopyButton from '@components/ui/CopyButton'

interface CopyButtonProps {
  text: string
  className?: string
  size?: 'xs' | 'sm'
  label?: string
}

export const CopyButton = ({ text, className = '', size = 'xs', label }: CopyButtonProps) => {
  return (
    <SharedCopyButton
      text={text}
      size={size}
      variant="ghost"
      className={className}
      label={label}
      successLabel="Copied!"
      successMessage={null} // No toast in docs
    />
  )
}
