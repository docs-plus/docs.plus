export const TIMED_OUT = Symbol('within-timeout-timed-out')

// Promise.race attaches its own handler to both inputs, so a late rejection of
// `work` is already handled. Measured. Only the timer needs clearing.
export const withinTimeout = async <T>(
  work: Promise<T>,
  ms: number
): Promise<T | typeof TIMED_OUT> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), ms)
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}
