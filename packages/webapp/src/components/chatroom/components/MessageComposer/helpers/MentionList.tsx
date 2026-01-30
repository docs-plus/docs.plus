import { searchWorkspaceUsers } from '@api'
import { useApi } from '@hooks/useApi'
import { useStore } from '@stores'
import React, { forwardRef, useEffect, useImperativeHandle, useRef,useState } from 'react'

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
  const listRef = useRef(null)

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

      // @ts-ignore
      setWorkspaceUsers([everyoneOption, ...data])
      // Ensure first item is selected by default
      setSelectedIndex(0)
    }
    fetchWorkspaceUsers()
  }, [workspaceId])

  // Scroll selected item into view when it changes
  useEffect(() => {
    if (listRef.current && workspaceUsers.length > 0) {
      //@ts-ignore
      const selectedElement = listRef.current.querySelector(
        `.mention-item:nth-child(${selectedIndex + 1})`
      )
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex, workspaceUsers.length])

  //@ts-ignore
  const selectItem = (index) => {
    const item = workspaceUsers[index]
    if (item) {
      //@ts-ignore
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

  // Reset selection index whenever the user list changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [workspaceUsers])

  useImperativeHandle(ref, () => ({
    //@ts-ignore
    onKeyDown: (props) => {
      const { event } = props

      if (event.key === 'ArrowUp') {
        upHandler()
        event.preventDefault()
        return true
      }

      if (event.key === 'ArrowDown') {
        downHandler()
        event.preventDefault()
        return true
      }

      if (event.key === 'Enter') {
        enterHandler()
        event.preventDefault()
        return true
      }

      return false
    }
  }))

  return (
    <div className="dropdown-menu max-h-[300px] overflow-y-auto !p-1" ref={listRef}>
      {searchWorkspaceUsersLoading ? (
        <LoadingSkeleton />
      ) : workspaceUsers.length ? (
        workspaceUsers.map((item, index) => (
          <MentionItem
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
