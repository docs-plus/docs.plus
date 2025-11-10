export interface RetryOptions {
  maxAttempts?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
  jitter?: boolean
  onRetry?: (attempt: number, error: Error) => void
}

export interface RetryResult<T> {
  success: boolean
  result?: T
  error?: Error
  attempts: number
}

/**
 * Retries a function with exponential backoff
 * @param fn Function to retry (can be sync or async) - return false to retry, true/truthy to succeed
 * @param options Retry configuration options
 * @returns Promise with retry result
 */
export async function retryWithBackoff<T>(
  fn: () => T | Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    jitter = true,
    onRetry
  } = options

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await Promise.resolve(fn())

      // If result is false, treat as retry condition
      if (result === false) {
        if (attempt === maxAttempts) {
          // Last attempt and still false, return unsuccessful
          return {
            success: false,
            error: new Error('Condition not met after all attempts'),
            attempts: maxAttempts
          }
        }

        // Not last attempt, continue to retry logic
        lastError = new Error('Condition not met, retrying...')
      } else {
        // Result is truthy, return success
        return {
          success: true,
          result,
          attempts: attempt
        }
      }
    } catch (error) {
      lastError = error as Error

      if (attempt === maxAttempts) {
        break
      }
    }

    // Calculate delay with exponential backoff (only if not the last attempt)
    if (attempt < maxAttempts) {
      let delay = Math.min(initialDelayMs * Math.pow(backoffMultiplier, attempt - 1), maxDelayMs)

      // Add jitter to prevent thundering herd
      if (jitter) {
        delay = delay * (0.5 + Math.random() * 0.5)
      }

      // Call retry callback if provided
      onRetry?.(attempt, lastError)

      // Wait before next attempt
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  return {
    success: false,
    error: lastError || new Error('Unknown error'),
    attempts: maxAttempts
  }
}
