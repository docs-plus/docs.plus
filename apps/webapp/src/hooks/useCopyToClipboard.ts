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
  /** Callback after successful copy */
  onSuccess?: () => void
  /** Callback after failed copy */
  onError?: (error: Error) => void
}

export interface UseCopyToClipboardReturn {
  /** Whether content was just copied (for visual feedback) */
  copied: boolean
  /** Whether a copy operation is in progress */
  copying: boolean
  /** Copy text to clipboard */
  copy: (text: string) => Promise<boolean>
  /** Reset copied state manually */
  reset: () => void
}

/**
 * Hook for copying text to clipboard with visual feedback state.
 *
 * @example
 * // Basic usage
 * const { copy, copied } = useCopyToClipboard()
 * <button onClick={() => copy('Hello!')}>
 *   {copied ? <MdCheck /> : <MdContentCopy />}
 * </button>
 *
 * @example
 * // Without toast (inline feedback only)
 * const { copy, copied } = useCopyToClipboard({ successMessage: null })
 *
 * @example
 * // Custom messages
 * const { copy, copied } = useCopyToClipboard({
 *   successMessage: 'Link copied!',
 *   resetDelay: 3000
 * })
 */
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
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      setCopying(true)

      try {
        const success = await copyToClipboardUtil(text)

        if (!success) {
          throw new Error('Copy to clipboard failed')
        }

        // Success
        setCopied(true)
        setCopying(false)

        if (successMessage) {
          toast.Success(successMessage)
        }

        onSuccess?.()

        // Auto-reset after delay
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
