/* eslint-disable */
// @ts-nocheck

import { searchWorkspaceUsers } from '@api'
import { useApi } from '@hooks/useApi'
import React, { forwardRef, use, useEffect, useImperativeHandle, useState } from 'react'
import { useChatStore, useStore } from '@stores'
import { MdGroups } from 'react-icons/md'
import { Avatar } from '@components/ui/Avatar'

const everyoneOption = {
  id: 0,
  username: 'everyone',
  full_name: 'All Users',
  isEveryoneOption: true
}

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
    <div className="dropdown-menu !p-1">
      {workspaceUsers.length ? (
        workspaceUsers.map((item, index) => (
          <React.Fragment key={item.id}>
            <button
              className={`flex items-center ${index === selectedIndex ? 'is-selected' : ''}`}
              onClick={() => selectItem(index)}>
              {item.isEveryoneOption ? (
                <MdGroups className="mr-2 size-8 text-gray-600" />
              ) : (
                <Avatar
                  src={item.avatar_url}
                  avatarUpdatedAt={item.avatar_updated_at}
                  alt={item.full_name}
                  size="sm"
                  className="mr-2 size-8"
                />
              )}
              <span className="flex flex-col justify-start text-sm">
                {item.full_name}
                <span className="text-muted text-xs text-gray-600">@{item.username}</span>
              </span>
            </button>
            {index === 0 && <div className="divider m-0 h-2 p-0"></div>}
          </React.Fragment>
        ))
      ) : (
        <div className="item">No result</div>
      )}
    </div>
  )
})
