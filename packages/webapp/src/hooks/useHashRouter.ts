import { useEffect, useState } from 'react'

export const useHashRouter = () => {
  const [isHistoryView, setIsHistoryView] = useState(false)

  useEffect(() => {
    // Check initial hash
    const checkHash = () => {
      setIsHistoryView(window.location.hash === '#history')
    }

    // Check on mount
    checkHash()

    // Listen for hash changes
    window.addEventListener('hashchange', checkHash)

    // Cleanup
    return () => window.removeEventListener('hashchange', checkHash)
  }, [])

  return isHistoryView
}
