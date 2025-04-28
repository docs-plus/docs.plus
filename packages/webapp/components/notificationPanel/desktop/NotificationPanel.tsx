import { useMemo, useRef, useEffect } from 'react'
import { useStore } from '@stores'
import { EmptyNotificationState } from '../components/EmptyNotificationState'
import { NotificationItem } from '../components/NotificationItem'
import { NotificationHeader } from '../components/NotificationHeader'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useNotificationSummary } from '../hooks/useNotificationSummary'
import { LoadMoreButton } from '../components/LoadMoreButton'
import { useNotificationTabData } from '../hooks/useNotificationTabData'
import { TTab } from '@types'
import React from 'react'

export const NotificationPanel = () => {
  const {
    loadingNotification,
    notifications,
    notificationActiveTab,
    notificationTabs,
    setNotificationActiveTab
  } = useStore((state) => state)

  useNotificationSummary()
  useNotificationTabData()

  const activeTabNotifList = useMemo(() => {
    return notifications.get(notificationActiveTab) || []
  }, [notifications, notificationActiveTab])

  // Use refs to store references to the radio inputs
  const radioRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // When active tab changes, click the corresponding radio input
  useEffect(() => {
    const activeRadio = radioRefs.current[notificationActiveTab]
    if (activeRadio) {
      activeRadio.checked = true
    }
  }, [notificationActiveTab])

  // Set the initial tab on mount
  useEffect(() => {
    const activeRadio = radioRefs.current[notificationActiveTab]
    if (activeRadio) {
      activeRadio.checked = true
    }
  }, [])

  const setRadioRef = (label: string) => (el: HTMLInputElement | null) => {
    radioRefs.current[label] = el
  }

  return (
    <div className="w-full min-w-96 p-3 pb-0">
      <NotificationHeader />
      <div className="mt-4">
        <div className="tabs tabs-lift">
          {notificationTabs.map((tab) => (
            <React.Fragment key={`tab-group-${tab.label}`}>
              <input
                type="radio"
                name="notification_tabs"
                className="tab"
                aria-label={`${tab.label}${tab.count ? ` (${tab.count})` : ''}`}
                ref={setRadioRef(tab.label)}
                onChange={() => setNotificationActiveTab(tab.label as TTab)}
              />
              <div className="tab-content bg-base-100 border-base-300 p-3">
                <div className="max-h-96 overflow-hidden overflow-y-auto">
                  <LoadingSpinner
                    show={loadingNotification && notificationActiveTab === tab.label}
                  />
                  <EmptyNotificationState
                    show={
                      !loadingNotification &&
                      notificationActiveTab === tab.label &&
                      activeTabNotifList.length === 0
                    }
                  />

                  {notificationActiveTab === tab.label && (
                    <div className={`mb-3 flex-col gap-2`}>
                      {activeTabNotifList.map((notification, index) => (
                        <NotificationItem key={index} notification={notification} />
                      ))}

                      {activeTabNotifList.length > 0 && <LoadMoreButton />}
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
