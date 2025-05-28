import { useMemo, useRef, useEffect } from 'react'
import { useChatStore } from '@stores'
import { EmptyBookmarkState } from '../components/EmptyBookmarkState'
import { BookmarkItem } from '../components/BookmarkItem'
import { BookmarkHeader } from '../components/BookmarkHeader'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useBookmarkSummary } from '../hooks/useBookmarkSummary'
import { LoadMoreButton } from '../components/LoadMoreButton'
import { useBookmarkTabData } from '../hooks/useBookmarkTabData'
import React from 'react'

type TBookmarkTab = 'in progress' | 'archive' | 'read'

export const BookmarkPanel = () => {
  const { loadingBookmarks, bookmarks, bookmarkActiveTab, bookmarkTabs, setBookmarkActiveTab } =
    useChatStore((state) => state)

  useBookmarkSummary()
  useBookmarkTabData()

  const activeTabBookmarkList = useMemo(() => {
    return bookmarks.get(bookmarkActiveTab) || []
  }, [bookmarks, bookmarkActiveTab])

  // Use refs to store references to the radio inputs
  const radioRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // When active tab changes, click the corresponding radio input
  useEffect(() => {
    const activeRadio = radioRefs.current[bookmarkActiveTab]
    if (activeRadio) {
      activeRadio.checked = true
    }
  }, [bookmarkActiveTab])

  // Set the initial tab on mount
  useEffect(() => {
    const activeRadio = radioRefs.current[bookmarkActiveTab]
    if (activeRadio) {
      activeRadio.checked = true
    }
  }, [])

  const setRadioRef = (label: string) => (el: HTMLInputElement | null) => {
    radioRefs.current[label] = el
  }

  return (
    <div className="w-full min-w-96 p-3 pb-0">
      <BookmarkHeader />
      <div className="mt-4">
        <div className="tabs tabs-lift">
          {bookmarkTabs.map((tab) => (
            <React.Fragment key={`tab-group-${tab.label}`}>
              <input
                type="radio"
                name="bookmark_tabs"
                className="tab"
                aria-label={`${tab.label}${tab.count ? ` (${tab.count})` : ''}`}
                ref={setRadioRef(tab.label)}
                onChange={() => setBookmarkActiveTab(tab.label as TBookmarkTab)}
              />
              <div className="tab-content bg-base-100 border-base-300 p-3 pr-0 pb-0">
                <div className="max-h-96 overflow-x-hidden overflow-y-auto">
                  <LoadingSpinner show={loadingBookmarks && bookmarkActiveTab === tab.label} />
                  <EmptyBookmarkState
                    show={
                      !loadingBookmarks &&
                      bookmarkActiveTab === tab.label &&
                      activeTabBookmarkList.length === 0
                    }
                  />

                  {bookmarkActiveTab === tab.label && (
                    <div className={`mb-3 flex-col gap-2`}>
                      {activeTabBookmarkList.map((bookmark, index) => (
                        <BookmarkItem key={index} bookmark={bookmark} />
                      ))}

                      {activeTabBookmarkList.length > 0 && <LoadMoreButton />}
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
