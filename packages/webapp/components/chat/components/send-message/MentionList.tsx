/* eslint-disable */
// @ts-nocheck

import { searchWorkspaceUsers } from '@api'
import { useApi } from '@hooks/useApi'
import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { useStore } from '@stores'
import MentionItem from './MentionItem'

const everyoneOption = {
  id: 0,
  username: 'everyone',
  full_name: 'All Users',
  isEveryoneOption: true
}

const LoadingSkeleton = () => (
  <div className="item flex items-center px-3 py-1">
    <div className="flex items-center gap-4">
      <div className="skeleton h-14 w-14 !rounded-full" />
      <div className="flex flex-col gap-4">
        <div className="skeleton h-4 w-28" />
        <div className="skeleton h-4 w-20" />
      </div>
    </div>
  </div>
)

export default forwardRef((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [workspaceUsers, setWorkspaceUsers] = useState([])
  const { workspaceId } = useStore((state) => state.settings)

  const { request: searchWorkspaceUsersRequest, loading: searchWorkspaceUsersLoading } = useApi(
    searchWorkspaceUsers,
    null,
    false
  )

  useEffect(() => {
    const fetchWorkspaceUsers = async () => {
      const { data, error } = await searchWorkspaceUsersRequest({ workspaceId })
      if (error) {
        console.error(error)
        return
      }

      setWorkspaceUsers([everyoneOption, ...data])
    }
    fetchWorkspaceUsers()
  }, [workspaceId])

  const selectItem = (index) => {
    const item = workspaceUsers[index]
    if (item) {
      props.command({ id: item.id, label: item.username })
    }
  }

  const upHandler = () => {
    setSelectedIndex((selectedIndex + workspaceUsers.length - 1) % workspaceUsers.length)
  }

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % workspaceUsers.length)
  }

  const enterHandler = () => {
    selectItem(selectedIndex)
  }

  useEffect(() => setSelectedIndex(0), [workspaceUsers])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      // Check if popup exists and is visible
      const tippyInstance = document.querySelector('[data-tippy-root]')
      const isPopupVisible =
        tippyInstance && window.getComputedStyle(tippyInstance).visibility === 'visible'

      if (event.key === 'ArrowUp') {
        upHandler()
        return true
      }

      if (event.key === 'ArrowDown') {
        downHandler()
        return true
      }

      if (event.key === 'Enter' && isPopupVisible) {
        event.preventDefault()
        event.stopPropagation()
        enterHandler()
        return true
      }

      return false
    }
  }))

  return (
    <div className="dropdown-menu max-h-[300px] overflow-y-auto !p-1">
      {searchWorkspaceUsersLoading ? (
        <LoadingSkeleton />
      ) : workspaceUsers.length ? (
        workspaceUsers.map((item, index) => (
          <MentionItem
            key={item.id}
            item={item}
            index={index}
            selectedIndex={selectedIndex}
            onSelect={selectItem}
          />
        ))
      ) : (
        <div className="item px-3 py-1 text-gray-500">No results found</div>
      )}
    </div>
  )
})
