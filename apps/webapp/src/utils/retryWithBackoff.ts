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

/** `fn` returns false to retry, true or any other truthy value to succeed. */
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

      if (result === false) {
        if (attempt === maxAttempts) {
          return {
            success: false,
            error: new Error('Condition not met after all attempts'),
            attempts: maxAttempts
          }
        }

        lastError = new Error('Condition not met, retrying...')
      } else {
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

    if (attempt < maxAttempts) {
      let delay = Math.min(initialDelayMs * Math.pow(backoffMultiplier, attempt - 1), maxDelayMs)

      // Add jitter to prevent thundering herd
      if (jitter) {
        delay = delay * (0.5 + Math.random() * 0.5)
      }

      onRetry?.(attempt, lastError)

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  return {
    success: false,
    error: lastError || new Error('Unknown error'),
    attempts: maxAttempts
  }
}
