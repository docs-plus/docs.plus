import React, { useState, useEffect } from 'react'

import { OfflineCloud, OnlineCloud } from './icons/Icons'

const OnlineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
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
    <div className=''>
      {showStatus && (
        <div className={` flex align-baseline justify-center status ${isOnline ? 'online' : 'offline'}`}>
          {isOnline
            ? <span className='flex align-baseline justify-center text-xs font-medium text-gray-500'>
            <OnlineCloud className="mr-2" /> Saved to docsplus
            </span>
            : <span className='flex align-baseline justify-center text-xs font-medium text-gray-500'>
              <OfflineCloud className="mr-2"/>Working offline
              </span>}
        </div>
      )}
    </div>
  )
}

export default OnlineIndicator
