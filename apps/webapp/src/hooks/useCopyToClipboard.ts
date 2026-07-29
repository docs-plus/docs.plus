import * as toast from '@components/toast'
import { copyToClipboard as copyToClipboardUtil } from '@utils/clipboard'
import { useCallback, useRef, useState } from 'react'

export interface UseCopyToClipboardOptions {
  /** Duration in ms to show "copied" state (default: 2000) */
  resetDelay?: number
  /** Toast message on success (set to null to disable toast) */
  successMessage?: string | null
  /** Toast message on error (set to null to disable toast) */
  errorMessage?: string | null
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export interface UseCopyToClipboardReturn {
  /** True for `resetDelay` ms after a successful copy, for inline button feedback. */
  copied: boolean
  copying: boolean
  copy: (text: string) => Promise<boolean>
  reset: () => void
}

export const useCopyToClipboard = (
  options: UseCopyToClipboardOptions = {}
): UseCopyToClipboardReturn => {
  const {
    resetDelay = 2000,
    successMessage = 'Copied to clipboard',
    errorMessage = 'Failed to copy',
    onSuccess,
    onError
  } = options

  const [copied, setCopied] = useState(false)
  const [copying, setCopying] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const reset = useCallback(() => {
    setCopied(false)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      setCopying(true)

      try {
        const success = await copyToClipboardUtil(text)

        if (!success) {
          throw new Error('Copy to clipboard failed')
        }

        setCopied(true)
        setCopying(false)

        if (successMessage) {
          toast.Success(successMessage)
        }

        onSuccess?.()

        timeoutRef.current = setTimeout(() => {
          setCopied(false)
        }, resetDelay)

        return true
      } catch (err) {
        setCopying(false)
        setCopied(false)

        const error = err instanceof Error ? err : new Error('Unknown error')

        if (errorMessage) {
          toast.Error(errorMessage)
        }

        onError?.(error)
        console.error('Copy to clipboard failed:', error)

        return false
      }
    },
    [resetDelay, successMessage, errorMessage, onSuccess, onError]
  )

  return { copied, copying, copy, reset }
}

export default useCopyToClipboard
