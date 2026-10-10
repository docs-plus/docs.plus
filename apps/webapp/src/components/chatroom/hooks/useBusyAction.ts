import { useRef, useState } from 'react'

/**
 * Runs an async action and reports busy until it settles. A second call while busy
 * does nothing; the ref guard also holds before the busy render lands.
 */
export const useBusyAction = <A extends unknown[]>(
  action: (...args: A) => Promise<void>
): [busy: boolean, run: (...args: A) => Promise<void>] => {
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  const run = async (...args: A) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      await action(...args)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return [busy, run]
}
