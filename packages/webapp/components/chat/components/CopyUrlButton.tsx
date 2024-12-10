import { MdLink } from 'react-icons/md'
import * as toast from '@components/toast'

interface CopyUrlButtonProps {
  url?: string
  className?: string
  successMessage?: string
  errorMessage?: string
}

export const CopyUrlButton = ({
  url,
  className = 'btn btn-circle btn-ghost btn-xs',
  successMessage = 'URL copied to clipboard',
  errorMessage = 'Failed to copy URL'
}: CopyUrlButtonProps) => {
  const handleCopyUrl = () => {
    if (!url) return

    navigator.clipboard
      .writeText(url)
      .then(() => {
        toast.Success(successMessage)
      })
      .catch((err) => {
        console.error('Failed to copy URL:', err)
        toast.Error(errorMessage)
      })
  }

  return (
    <button className={className} onClick={handleCopyUrl} title="Copy URL">
      <MdLink size={20} className="rotate-45" />
    </button>
  )
}
