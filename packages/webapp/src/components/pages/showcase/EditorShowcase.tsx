/**
 * EditorShowcase Component
 * ========================
 * Showcase page for Document Editor features.
 * Includes TOC (Table of Contents) and Chatroom panels.
 */

import { Avatar } from '@components/ui'
import Head from 'next/head'
import { useState } from 'react'
import {
  MdAlternateEmail,
  MdAttachFile,
  MdBookmark,
  MdChat,
  MdChevronRight,
  MdClose,
  MdCloudDone,
  MdCode,
  MdComment,
  MdEdit,
  MdEmojiEmotions,
  MdExpandMore,
  MdFormatAlignCenter,
  MdFormatAlignLeft,
  MdFormatAlignRight,
  MdFormatBold,
  MdFormatItalic,
  MdFormatListBulleted,
  MdFormatListNumbered,
  MdFormatQuote,
  MdFormatStrikethrough,
  MdFormatUnderlined,
  MdFullscreen,
  MdHistory,
  MdHorizontalRule,
  MdImage,
  MdKeyboardArrowDown,
  MdLink,
  MdMoreVert,
  MdOutlineCode,
  MdOutlineFormatQuote,
  MdOutlineTableChart,
  MdPeople,
  MdPrint,
  MdRedo,
  MdSend,
  MdSettings,
  MdShare,
  MdTableChart,
  MdUndo,
  MdVisibility} from 'react-icons/md'

import { ShowcaseLayout } from './layouts'

// TOC Data Structure
interface TocItem {
  id: string
  title: string
  level: number
  commentCount?: number
  children?: TocItem[]
  isExpanded?: boolean
}

const TOC_DATA: TocItem[] = [
  {
    id: 'doc-root',
    title: 'Product Requirements Document',
    level: 0,
    commentCount: 7,
    isExpanded: true,
    children: [
      {
        id: 'executive-summary',
        title: 'Executive Summary',
        level: 1,
        commentCount: 2
      },
      {
        id: 'goals',
        title: 'Goals & Objectives',
        level: 1,
        commentCount: 3,
        isExpanded: true,
        children: [
          { id: 'goal-1', title: 'Improve real-time collaboration', level: 2, commentCount: 1 },
          { id: 'goal-2', title: 'Enhanced offline support', level: 2 },
          { id: 'goal-3', title: 'Better mobile experience', level: 2, commentCount: 2 }
        ]
      },
      {
        id: 'features',
        title: 'Feature Requirements',
        level: 1,
        commentCount: 5,
        isExpanded: true,
        children: [
          { id: 'feat-1', title: 'Comments & Mentions', level: 2, commentCount: 4 },
          { id: 'feat-2', title: 'Version History', level: 2, commentCount: 1 },
          { id: 'feat-3', title: 'Export Options', level: 2 }
        ]
      },
      {
        id: 'timeline',
        title: 'Timeline & Milestones',
        level: 1,
        commentCount: 1
      },
      {
        id: 'appendix',
        title: 'Appendix',
        level: 1
      }
    ]
  }
]

// Chat Messages
interface ChatMessage {
  id: string
  userId: string
  userName: string
  message: string
  timestamp: string
  isCurrentUser?: boolean
}

const CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    userId: 'user-1',
    userName: 'Sarah Miller',
    message: "Hey team! I've updated the collaboration section. Can you review?",
    timestamp: '10:30 AM'
  },
  {
    id: 'msg-2',
    userId: 'user-2',
    userName: 'Alex Chen',
    message: 'Looks great! I added some comments on the export options.',
    timestamp: '10:45 AM'
  },
  {
    id: 'msg-3',
    userId: 'user-3',
    userName: 'Jordan Lee',
    message: "I'm working on the technical specs for version history. Should be done by EOD.",
    timestamp: '11:15 AM'
  },
  {
    id: 'msg-4',
    userId: 'current',
    userName: 'You',
    message: 'Perfect! Let me know if you need any clarification on the requirements.',
    timestamp: '11:20 AM',
    isCurrentUser: true
  }
]

// Demo collaborators
const COLLABORATORS = [
  { id: 'user-1', name: 'Sarah Miller', color: '#3b82f6' },
  { id: 'user-2', name: 'Alex Chen', color: '#10b981' },
  { id: 'user-3', name: 'Jordan Lee', color: '#f59e0b' }
]

const TOOLBAR_GROUPS = [
  {
    name: 'History',
    items: [
      { icon: MdUndo, label: 'Undo', shortcut: '⌘Z' },
      { icon: MdRedo, label: 'Redo', shortcut: '⌘⇧Z' }
    ]
  },
  {
    name: 'Format',
    items: [
      { icon: MdFormatBold, label: 'Bold', shortcut: '⌘B', active: true },
      { icon: MdFormatItalic, label: 'Italic', shortcut: '⌘I' },
      { icon: MdFormatUnderlined, label: 'Underline', shortcut: '⌘U' },
      { icon: MdFormatStrikethrough, label: 'Strikethrough' },
      { icon: MdCode, label: 'Code', shortcut: '⌘E' }
    ]
  },
  {
    name: 'Insert',
    items: [
      { icon: MdLink, label: 'Link', shortcut: '⌘K' },
      { icon: MdImage, label: 'Image' },
      { icon: MdTableChart, label: 'Table' },
      { icon: MdHorizontalRule, label: 'Divider' }
    ]
  },
  {
    name: 'Lists',
    items: [
      { icon: MdFormatListBulleted, label: 'Bullet List' },
      { icon: MdFormatListNumbered, label: 'Numbered List' },
      { icon: MdFormatQuote, label: 'Quote' }
    ]
  },
  {
    name: 'Align',
    items: [
      { icon: MdFormatAlignLeft, label: 'Align Left', active: true },
      { icon: MdFormatAlignCenter, label: 'Align Center' },
      { icon: MdFormatAlignRight, label: 'Align Right' }
    ]
  }
]

// TOC Item Component
const TocItemComponent = ({
  item,
  selectedId,
  onSelect,
  depth = 0
}: {
  item: TocItem
  selectedId: string
  onSelect: (id: string) => void
  depth?: number
}) => {
  const [isExpanded, setIsExpanded] = useState(item.isExpanded ?? false)
  const hasChildren = item.children && item.children.length > 0

  return (
    <div>
      <button
        onClick={() => {
          onSelect(item.id)
          if (hasChildren) setIsExpanded(!isExpanded)
        }}
        className={`group hover:bg-base-200 flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
          selectedId === item.id ? 'bg-primary/10 text-primary font-medium' : 'text-base-content/80'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}>
        {/* Expand/Collapse Icon */}
        {hasChildren ? (
          <span className="text-base-content/40 shrink-0">
            {isExpanded ? <MdExpandMore size={16} /> : <MdChevronRight size={16} />}
          </span>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* Title */}
        <span className="flex-1 truncate">{item.title}</span>

        {/* Comment Badge */}
        {item.commentCount && item.commentCount > 0 && (
          <span
            className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
              selectedId === item.id
                ? 'bg-primary text-primary-content'
                : 'bg-primary/10 text-primary'
            }`}>
            {item.commentCount}
          </span>
        )}
      </button>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {item.children!.map((child) => (
            <TocItemComponent
              key={child.id}
              item={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export const EditorShowcase = () => {
  const [viewMode, setViewMode] = useState<'edit' | 'view'>('edit')
  const [showComments, setShowComments] = useState(true)
  const [showToc, setShowToc] = useState(true)
  const [showChat, setShowChat] = useState(true)
  const [selectedTocId, setSelectedTocId] = useState('goals')
  const [chatMessage, setChatMessage] = useState('')

  return (
    <>
      <Head>
        <title>Document Editor | docs.plus Showcase</title>
      </Head>
      <ShowcaseLayout
        title="Document Editor"
        description="A powerful, real-time collaborative document editor.">
        {/* Editor Container */}
        <div className="border-base-300 bg-base-100 overflow-hidden rounded-2xl border shadow-xl">
          {/* Editor Header */}
          <header className="border-base-300 flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-3">
              {/* Document Title */}
              <div className="group flex items-center gap-2">
                <input
                  type="text"
                  defaultValue="Product Requirements Document"
                  className="bg-transparent text-lg font-semibold outline-none"
                />
                <MdEdit
                  size={16}
                  className="text-base-content/40 opacity-0 transition-opacity group-hover:opacity-100"
                />
              </div>
              {/* Save Status */}
              <div className="text-success flex items-center gap-1 text-xs">
                <MdCloudDone size={14} />
                <span>Saved</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Collaborators */}
              <div className="mr-2 hidden items-center gap-2 sm:flex">
                <div className="avatar-group -space-x-2">
                  {COLLABORATORS.map((user) => (
                    <div key={user.id} className="tooltip tooltip-bottom" data-tip={user.name}>
                      <Avatar id={user.id} size="sm" clickable={false} />
                    </div>
                  ))}
                </div>
                <span className="text-base-content/60 text-xs">3 editing</span>
              </div>

              {/* View Mode Toggle */}
              <div className="join">
                <button
                  className={`btn btn-sm join-item gap-1 ${viewMode === 'edit' ? 'btn-active' : ''}`}
                  onClick={() => setViewMode('edit')}>
                  <MdEdit size={16} />
                  <span className="hidden sm:inline">Edit</span>
                </button>
                <button
                  className={`btn btn-sm join-item gap-1 ${viewMode === 'view' ? 'btn-active' : ''}`}
                  onClick={() => setViewMode('view')}>
                  <MdVisibility size={16} />
                  <span className="hidden sm:inline">View</span>
                </button>
              </div>

              {/* Actions */}
              <button
                className={`btn btn-sm btn-circle ${showToc ? 'btn-active bg-base-200' : 'btn-ghost'}`}
                onClick={() => setShowToc(!showToc)}
                title="Table of Contents">
                <MdFormatListBulleted size={20} />
              </button>
              <button
                className={`btn btn-sm btn-circle ${showChat ? 'btn-active bg-base-200' : 'btn-ghost'}`}
                onClick={() => setShowChat(!showChat)}
                title="Chatroom">
                <MdChat size={20} />
              </button>
              <button className="btn btn-ghost btn-sm btn-circle" title="Version History">
                <MdHistory size={20} />
              </button>
              <button
                className={`btn btn-sm btn-circle ${showComments ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setShowComments(!showComments)}
                title="Comments">
                <MdComment size={20} />
              </button>
              <button className="btn btn-primary btn-sm gap-1">
                <MdShare size={16} />
                <span className="hidden sm:inline">Share</span>
              </button>
              <div className="dropdown dropdown-end">
                <button tabIndex={0} className="btn btn-ghost btn-sm btn-circle">
                  <MdMoreVert size={20} />
                </button>
                <ul className="dropdown-content menu bg-base-100 border-base-300 z-10 w-52 rounded-xl border p-2 shadow-lg">
                  <li>
                    <a>
                      <MdPrint size={18} /> Print
                    </a>
                  </li>
                  <li>
                    <a>
                      <MdFullscreen size={18} /> Full screen
                    </a>
                  </li>
                  <li>
                    <a>
                      <MdSettings size={18} /> Document settings
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </header>

          {/* Toolbar */}
          <div className="border-base-300 bg-base-200/50 flex flex-wrap items-center gap-1 border-b px-2 py-2">
            {/* Heading Selector */}
            <div className="dropdown">
              <button tabIndex={0} className="btn btn-ghost btn-sm gap-1 text-sm">
                Heading 1
                <MdKeyboardArrowDown size={16} />
              </button>
              <ul className="dropdown-content menu bg-base-100 border-base-300 z-10 w-48 rounded-xl border p-2 shadow-lg">
                <li>
                  <a className="text-3xl font-bold">Heading 1</a>
                </li>
                <li>
                  <a className="text-2xl font-bold">Heading 2</a>
                </li>
                <li>
                  <a className="text-xl font-semibold">Heading 3</a>
                </li>
                <li>
                  <a className="text-lg font-semibold">Heading 4</a>
                </li>
                <li>
                  <a className="text-base">Paragraph</a>
                </li>
              </ul>
            </div>

            <div className="divider divider-horizontal mx-1 h-6"></div>

            {/* Toolbar Groups */}
            {TOOLBAR_GROUPS.map((group, groupIndex) => (
              <div key={group.name} className="flex items-center">
                {group.items.map((item) => (
                  <button
                    key={item.label}
                    className={`btn btn-ghost btn-sm btn-square ${'active' in item && item.active ? 'bg-primary/10 text-primary' : ''}`}
                    title={'shortcut' in item ? `${item.label} (${item.shortcut})` : item.label}>
                    <item.icon size={18} />
                  </button>
                ))}
                {groupIndex < TOOLBAR_GROUPS.length - 1 && (
                  <div className="divider divider-horizontal mx-1 h-6"></div>
                )}
              </div>
            ))}
          </div>

          {/* Editor Content */}
          <div className="flex min-h-[600px]">
            {/* TOC Sidebar */}
            {showToc && (
              <aside className="border-base-300 bg-base-100 w-64 shrink-0 overflow-y-auto border-r">
                <div className="border-base-300 bg-base-100 sticky top-0 border-b px-3 py-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Table of Contents</h3>
                    <button
                      onClick={() => setShowToc(false)}
                      className="btn btn-ghost btn-xs btn-circle text-base-content/50 hover:text-base-content">
                      <MdClose size={16} />
                    </button>
                  </div>
                </div>
                <div className="p-2">
                  {TOC_DATA.map((item) => (
                    <TocItemComponent
                      key={item.id}
                      item={item}
                      selectedId={selectedTocId}
                      onSelect={setSelectedTocId}
                    />
                  ))}
                </div>
              </aside>
            )}

            {/* Main Editor Area */}
            <div className="flex flex-1 flex-col">
              {/* Document Content */}
              <div className="flex flex-1 overflow-hidden">
                {/* Editor */}
                <div className="flex-1 overflow-y-auto p-8">
                  <div className="prose prose-slate mx-auto max-w-3xl">
                    <h1>Product Requirements Document</h1>
                    <p className="lead">
                      This document outlines the requirements for the docs.plus v2.0 release,
                      focusing on enhanced collaboration features and improved performance.
                    </p>

                    <h2>Executive Summary</h2>
                    <p>
                      docs.plus is evolving to meet the growing demands of distributed teams. This
                      PRD covers the <strong>key features</strong> and{' '}
                      <em>technical requirements</em> for our next major release.
                    </p>

                    <h2>Goals & Objectives</h2>
                    <ul>
                      <li>
                        <strong>Improve real-time collaboration</strong> — Reduce latency to under
                        50ms
                      </li>
                      <li>
                        <strong>Enhanced offline support</strong> — Full editing capabilities
                        offline
                      </li>
                      <li>
                        <strong>Better mobile experience</strong> — Native-like performance on
                        mobile
                      </li>
                    </ul>

                    <h2>Feature Requirements</h2>
                    <h3>1. Comments & Mentions</h3>
                    <p>
                      Users should be able to add inline comments and mention collaborators using{' '}
                      <code>@username</code> syntax.
                    </p>

                    <blockquote>
                      <p>
                        "Comments are the primary way teams communicate context and feedback within
                        documents."
                      </p>
                    </blockquote>

                    <h3>2. Version History</h3>
                    <p>Implement a robust version history system that allows users to:</p>
                    <ol>
                      <li>View all changes with timestamps</li>
                      <li>Compare versions side-by-side</li>
                      <li>Restore any previous version</li>
                      <li>Name and bookmark important versions</li>
                    </ol>

                    {/* Simulated cursor/selection from another user */}
                    <div className="relative my-4">
                      <div
                        className="border-l-2 bg-blue-100/50 py-1 pl-2"
                        style={{ borderColor: COLLABORATORS[0].color }}>
                        <h3 className="mt-0">3. Export Options</h3>
                        <p className="mb-0">
                          Support exporting documents to PDF, Markdown, HTML, and DOCX formats with
                          customizable styling options.
                        </p>
                      </div>
                      {/* Cursor label */}
                      <div
                        className="absolute -top-5 left-0 rounded px-1.5 py-0.5 text-xs text-white"
                        style={{ backgroundColor: COLLABORATORS[0].color }}>
                        {COLLABORATORS[0].name}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Comments Sidebar */}
                {showComments && (
                  <aside className="border-base-300 bg-base-200/30 w-72 shrink-0 overflow-y-auto border-l p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-semibold">Comments</h3>
                      <span className="badge badge-primary badge-sm">3</span>
                    </div>

                    <div className="space-y-4">
                      {/* Comment 1 */}
                      <div className="bg-base-100 rounded-xl p-3 shadow-sm">
                        <div className="mb-2 flex items-center gap-2">
                          <Avatar id="user-1" size="xs" clickable={false} />
                          <div>
                            <p className="text-sm font-medium">Sarah Miller</p>
                            <p className="text-base-content/50 text-xs">2 hours ago</p>
                          </div>
                        </div>
                        <p className="text-sm">
                          Should we also include real-time presence indicators in the collaboration
                          features?
                        </p>
                        <div className="mt-2 flex gap-2">
                          <button className="btn btn-ghost btn-xs">Reply</button>
                          <button className="btn btn-ghost btn-xs text-success">Resolve</button>
                        </div>
                      </div>

                      {/* Comment 2 */}
                      <div className="bg-base-100 rounded-xl p-3 shadow-sm">
                        <div className="mb-2 flex items-center gap-2">
                          <Avatar id="user-2" size="xs" clickable={false} />
                          <div>
                            <p className="text-sm font-medium">Alex Chen</p>
                            <p className="text-base-content/50 text-xs">1 hour ago</p>
                          </div>
                        </div>
                        <p className="text-sm">
                          Great point! I'll add that to the requirements. Also @Jordan Lee can you
                          review the technical specs?
                        </p>
                      </div>

                      {/* Comment 3 */}
                      <div className="bg-base-100 border-success/30 rounded-xl border-l-4 p-3 shadow-sm">
                        <div className="mb-2 flex items-center gap-2">
                          <Avatar id="user-3" size="xs" clickable={false} />
                          <div>
                            <p className="text-sm font-medium">Jordan Lee</p>
                            <p className="text-base-content/50 text-xs">30 min ago</p>
                          </div>
                        </div>
                        <p className="text-sm">
                          ✅ Reviewed! The export feature specs look solid. Ready for
                          implementation.
                        </p>
                        <span className="badge badge-success badge-sm mt-2">Resolved</span>
                      </div>
                    </div>
                  </aside>
                )}
              </div>

              {/* Chatroom Panel */}
              {showChat && (
                <div className="border-base-300 bg-base-100 shrink-0 border-t">
                  {/* Chat Header with Breadcrumb */}
                  <div className="border-base-300 flex items-center justify-between border-b px-4 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      <MdChat size={16} className="text-primary" />
                      <span className="text-base-content/60">Product Requirements Document</span>
                      <MdChevronRight size={14} className="text-base-content/40" />
                      <span className="text-base-content/60">Goals & Objectives</span>
                      <MdChevronRight size={14} className="text-base-content/40" />
                      <span className="font-medium">Improve real-time collaboration</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button className="btn btn-ghost btn-xs btn-circle">
                        <MdAttachFile size={16} />
                      </button>
                      <button className="btn btn-ghost btn-xs btn-circle">
                        <MdAlternateEmail size={16} />
                      </button>
                      <button
                        onClick={() => setShowChat(false)}
                        className="btn btn-ghost btn-xs btn-circle">
                        <MdClose size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Chat Messages */}
                  <div className="max-h-48 overflow-y-auto px-4 py-3">
                    <div className="space-y-3">
                      {CHAT_MESSAGES.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex gap-3 ${msg.isCurrentUser ? 'flex-row-reverse' : ''}`}>
                          <Avatar id={msg.userId} size="sm" clickable={false} />
                          <div
                            className={`max-w-md ${msg.isCurrentUser ? 'items-end text-right' : ''}`}>
                            <div className="mb-1 flex items-center gap-2">
                              <span className="text-xs font-medium">{msg.userName}</span>
                              <span className="text-base-content/40 text-xs">{msg.timestamp}</span>
                            </div>
                            <div
                              className={`rounded-2xl px-3 py-2 text-sm ${
                                msg.isCurrentUser
                                  ? 'bg-primary text-primary-content rounded-br-md'
                                  : 'bg-base-200 rounded-bl-md'
                              }`}>
                              {msg.message}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Chat Input */}
                  <div className="border-base-300 border-t px-4 py-3">
                    <div className="flex items-end gap-2">
                      <div className="bg-base-200 flex flex-1 items-center gap-2 rounded-2xl px-3 py-2">
                        <input
                          type="text"
                          placeholder="Write a message..."
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          className="flex-1 bg-transparent text-sm outline-none"
                        />
                        <div className="flex items-center gap-1">
                          <button className="btn btn-ghost btn-xs btn-circle text-base-content/50 hover:text-base-content">
                            <MdEmojiEmotions size={18} />
                          </button>
                          <button className="btn btn-ghost btn-xs btn-circle text-base-content/50 hover:text-base-content">
                            <MdAttachFile size={18} />
                          </button>
                        </div>
                      </div>
                      <button
                        className={`btn btn-circle btn-sm ${chatMessage ? 'btn-primary' : 'btn-ghost'}`}
                        disabled={!chatMessage}>
                        <MdSend size={18} />
                      </button>
                    </div>
                    {/* Formatting Options */}
                    <div className="mt-2 flex items-center gap-1">
                      <button className="btn btn-ghost btn-xs">
                        <MdFormatBold size={14} />
                      </button>
                      <button className="btn btn-ghost btn-xs">
                        <MdFormatItalic size={14} />
                      </button>
                      <button className="btn btn-ghost btn-xs">
                        <MdFormatStrikethrough size={14} />
                      </button>
                      <button className="btn btn-ghost btn-xs">
                        <MdLink size={14} />
                      </button>
                      <button className="btn btn-ghost btn-xs">
                        <MdFormatListBulleted size={14} />
                      </button>
                      <button className="btn btn-ghost btn-xs">
                        <MdFormatListNumbered size={14} />
                      </button>
                      <button className="btn btn-ghost btn-xs">
                        <MdOutlineTableChart size={14} />
                      </button>
                      <button className="btn btn-ghost btn-xs">
                        <MdOutlineCode size={14} />
                      </button>
                      <button className="btn btn-ghost btn-xs">
                        <MdOutlineFormatQuote size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer / Status Bar */}
          <footer className="border-base-300 bg-base-200/50 flex items-center justify-between border-t px-4 py-2 text-xs">
            <div className="text-base-content/60 flex items-center gap-4">
              <span>1,234 words</span>
              <span>•</span>
              <span>5 min read</span>
              <span>•</span>
              <span>Last edited 2 min ago</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-success flex items-center gap-1">
                <MdPeople size={14} />3 collaborators
              </span>
            </div>
          </footer>
        </div>

        {/* Features Grid */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: MdFormatListBulleted,
              title: 'Table of Contents',
              description: 'Navigate your document with a collapsible TOC showing all headings.'
            },
            {
              icon: MdChat,
              title: 'Section Chatrooms',
              description: 'Discuss specific sections in real-time with threaded conversations.'
            },
            {
              icon: MdPeople,
              title: 'Real-time Collaboration',
              description: 'See changes as they happen with live cursors and presence indicators.'
            },
            {
              icon: MdComment,
              title: 'Inline Comments',
              description: 'Add contextual feedback and mentions anywhere in your document.'
            },
            {
              icon: MdHistory,
              title: 'Version History',
              description: 'Track every change with detailed history and easy rollback.'
            },
            {
              icon: MdBookmark,
              title: 'Bookmarks',
              description: 'Save important sections for quick navigation and reference.'
            },
            {
              icon: MdShare,
              title: 'Easy Sharing',
              description: 'Share with anyone via link, email, or embed in your website.'
            },
            {
              icon: MdCloudDone,
              title: 'Auto-save',
              description: 'Never lose work with automatic saving and offline support.'
            }
          ].map((feature) => (
            <div
              key={feature.title}
              className="card border-base-300 bg-base-100 border transition-shadow hover:shadow-lg">
              <div className="card-body">
                <div className="bg-primary/10 mb-2 flex size-12 items-center justify-center rounded-xl">
                  <feature.icon size={24} className="text-primary" />
                </div>
                <h3 className="card-title text-base">{feature.title}</h3>
                <p className="text-base-content/70 text-sm">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </ShowcaseLayout>
    </>
  )
}

export default EditorShowcase
