/**
 * ChatPanel Component
 * ====================
 * Floating chat panel with live messaging demo.
 */

import { useState } from 'react'
import { MdChat, MdChevronRight, MdSend } from 'react-icons/md'
import { Avatar, CloseButton } from '@components/ui'
import { useDesignSystem } from '../../context/DesignSystemContext'
import { DEMO_MESSAGES } from '../../constants/demoData'

export const ChatPanel = () => {
  const { chatMessage, setChatMessage } = useDesignSystem()
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="bg-primary text-primary-content fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full px-4 py-3 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
        aria-label="Open team chat">
        <MdChat size={24} aria-hidden="true" />
        <span className="hidden font-medium sm:inline">Team Chat</span>
        <span className="badge badge-secondary badge-sm">4</span>
      </button>
    )
  }

  return (
    <aside
      className={`border-base-300 bg-base-100 fixed right-4 bottom-4 z-40 flex w-80 flex-col rounded-2xl border shadow-2xl transition-all duration-300 sm:w-96 ${isMinimized ? 'h-14' : 'h-[28rem]'}`}
      role="complementary"
      aria-label="Team chat">
      {/* Chat Header */}
      <div className="border-base-300 bg-primary text-primary-content flex shrink-0 items-center justify-between rounded-t-2xl border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <MdChat size={20} aria-hidden="true" />
          <span className="font-semibold">Team Chat</span>
          <span className="badge badge-secondary badge-xs">Live</span>
        </div>
        <div className="flex gap-1">
          <button
            className="btn btn-ghost btn-circle btn-xs text-primary-content transition-transform hover:scale-110"
            onClick={() => setIsMinimized(!isMinimized)}
            aria-label={isMinimized ? 'Expand chat' : 'Minimize chat'}>
            {isMinimized ? (
              <MdChevronRight size={16} className="rotate-[-90deg]" />
            ) : (
              <MdChevronRight size={16} className="rotate-90" />
            )}
          </button>
          <CloseButton
            size="xs"
            onClick={() => setIsOpen(false)}
            className="text-primary-content hover:bg-primary-content/20"
          />
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Chat Messages */}
          <div
            className="bg-base-200 flex-1 space-y-3 overflow-y-auto p-4"
            role="log"
            aria-live="polite"
            aria-label="Chat messages">
            {DEMO_MESSAGES.map((msg) => (
              <div key={msg.id} className={`chat ${msg.isMe ? 'chat-end' : 'chat-start'}`}>
                <div className="avatar chat-image">
                  <Avatar id={msg.userId} size="xs" clickable={false} />
                </div>
                <div className="chat-header text-xs opacity-70">
                  {msg.user}
                  <time className="ml-1" dateTime={msg.time}>
                    {msg.time}
                  </time>
                </div>
                <div className={`chat-bubble text-sm ${msg.isMe ? 'chat-bubble-primary' : ''}`}>
                  {msg.message}
                </div>
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <div className="border-base-300 shrink-0 border-t p-3">
            <form className="join w-full" onSubmit={(e) => e.preventDefault()}>
              <label className="sr-only" htmlFor="chat-input">
                Type a message
              </label>
              <input
                id="chat-input"
                type="text"
                placeholder="Type a message..."
                className="input input-bordered input-sm join-item w-full"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm join-item"
                aria-label="Send message">
                <MdSend size={18} aria-hidden="true" />
              </button>
            </form>
          </div>
        </>
      )}
    </aside>
  )
}
