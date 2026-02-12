import CopyButton from '@components/ui/CopyButton'
import { LuLink } from 'react-icons/lu'

interface CopyUrlButtonProps {
  url?: string
  className?: string
  successMessage?: string
  errorMessage?: string
  dataTip?: string
}

export const CopyUrlButton = ({
  url,
  className = '',
  successMessage = 'URL copied to clipboard',
  errorMessage = 'Failed to copy URL',
  dataTip = 'Copy URL'
}: CopyUrlButtonProps) => {
  if (!url) return null

  return (
    <CopyButton
      text={url}
      size="xs"
      variant="ghost"
      circle
      icon={LuLink}
      className={className}
      tooltip={dataTip}
      successMessage={successMessage}
      errorMessage={errorMessage}
    />
  )
}
