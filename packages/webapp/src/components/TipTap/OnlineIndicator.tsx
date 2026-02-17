import { Icons } from '@icons'
import React, { useEffect, useState } from 'react'

const OnlineIndicator = ({ className }: { className: string }) => {
  const [isOnline, setIsOnline] = useState(false)
  const [showStatus, setShowStatus] = useState(true)

  useEffect(() => {
    const handleOnlineStatus = () => {
      setIsOnline(true)
      setShowStatus(true)
    }
    const handleOfflineStatus = () => {
      setIsOnline(false)
      setShowStatus(true)
    }

    window.addEventListener('online', handleOnlineStatus)
    window.addEventListener('offline', handleOfflineStatus)

    return () => {
      window.removeEventListener('online', handleOnlineStatus)
      window.removeEventListener('offline', handleOfflineStatus)
    }
  }, [])

  useEffect(() => {
    if (showStatus) {
      const timer = setTimeout(() => {
        setShowStatus(false)
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [showStatus])

  return (
    <div className={className}>
      {showStatus && (
        <div
          className={`status flex justify-center align-baseline ${
            isOnline ? 'online' : 'offline'
          }`}>
          {isOnline ? (
            <span className="text-base-content/50 flex justify-center align-baseline text-xs font-medium">
              <Icons.cloud className="mr-2" /> Saved to docsplus
            </span>
          ) : (
            <span className="text-base-content/50 flex justify-center align-baseline text-xs font-medium">
              <Icons.cloudOff className="mr-2" />
              Working offline
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default OnlineIndicator
