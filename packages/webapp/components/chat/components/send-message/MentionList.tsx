/* eslint-disable */
// @ts-nocheck

import { searchWorkspaceUsers } from '@api'
import { useApi } from '@hooks/useApi'
import React, { forwardRef, use, useEffect, useImperativeHandle, useState } from 'react'
import { useChatStore, useStore } from '@stores'

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
      setWorkspaceUsers(data)
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
    <div className="dropdown-menu">
      {workspaceUsers.length ? (
        workspaceUsers.map((item, index) => (
          <button
            className={index === selectedIndex ? 'is-selected' : ''}
            key={index}
            onClick={() => selectItem(index)}>
            {item.username}
          </button>
        ))
      ) : (
        <div className="item">No result</div>
      )}
    </div>
  )
})
