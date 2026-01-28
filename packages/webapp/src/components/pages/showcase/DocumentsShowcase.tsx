/**
 * DocumentsShowcase Component
 * ===========================
 * Showcase page for Documents Management and Creation.
 */

import { useState } from 'react'
import Head from 'next/head'
import {
  MdAdd,
  MdSearch,
  MdSort,
  MdGridView,
  MdViewList,
  MdDescription,
  MdStar,
  MdStarBorder,
  MdMoreVert,
  MdEdit,
  MdShare,
  MdDelete,
  MdContentCopy,
  MdDriveFileMove,
  MdHistory,
  MdPeople,
  MdLock,
  MdPublic,
  MdAccessTime,
  MdInsertDriveFile,
  MdArticle,
  MdNoteAlt,
  MdListAlt,
  MdTableChart,
  MdCode,
  MdClose
} from 'react-icons/md'
import { Avatar } from '@components/ui'
import { ShowcaseLayout } from './layouts'

type ViewMode = 'grid' | 'list'
type SortBy = 'modified' | 'name' | 'created'
type FilterBy = 'all' | 'owned' | 'shared' | 'starred'

interface Document {
  id: string
  name: string
  type: 'document' | 'spreadsheet' | 'note' | 'code'
  owner: { id: string; name: string }
  modified: string
  created: string
  starred: boolean
  shared: boolean
  collaborators: string[]
  access: 'private' | 'team' | 'public'
}

interface Folder {
  id: string
  name: string
  count: number
  color: string
}

const DEMO_FOLDERS: Folder[] = [
  { id: '1', name: 'Product', count: 12, color: 'bg-blue-500' },
  { id: '2', name: 'Engineering', count: 8, color: 'bg-emerald-500' },
  { id: '3', name: 'Design', count: 15, color: 'bg-violet-500' },
  { id: '4', name: 'Marketing', count: 6, color: 'bg-amber-500' },
  { id: '5', name: 'HR', count: 4, color: 'bg-rose-500' }
]

const DEMO_DOCUMENTS: Document[] = [
  {
    id: '1',
    name: 'Q4 Product Roadmap',
    type: 'document',
    owner: { id: 'user-1', name: 'Sarah Miller' },
    modified: '2 hours ago',
    created: 'Oct 15, 2024',
    starred: true,
    shared: true,
    collaborators: ['user-2', 'user-3', 'user-4'],
    access: 'team'
  },
  {
    id: '2',
    name: 'Engineering Specs v2.1',
    type: 'document',
    owner: { id: 'user-2', name: 'Alex Chen' },
    modified: 'Yesterday',
    created: 'Oct 10, 2024',
    starred: true,
    shared: true,
    collaborators: ['user-1', 'user-3'],
    access: 'team'
  },
  {
    id: '3',
    name: 'Budget Tracker Q4',
    type: 'spreadsheet',
    owner: { id: 'user-1', name: 'Sarah Miller' },
    modified: '3 days ago',
    created: 'Oct 1, 2024',
    starred: false,
    shared: false,
    collaborators: [],
    access: 'private'
  },
  {
    id: '4',
    name: 'Design System Guidelines',
    type: 'document',
    owner: { id: 'user-3', name: 'Jordan Lee' },
    modified: '1 week ago',
    created: 'Sep 20, 2024',
    starred: false,
    shared: true,
    collaborators: ['user-1', 'user-2', 'user-4', 'user-5'],
    access: 'public'
  },
  {
    id: '5',
    name: 'Meeting Notes - Sprint 42',
    type: 'note',
    owner: { id: 'user-1', name: 'Sarah Miller' },
    modified: '2 weeks ago',
    created: 'Sep 15, 2024',
    starred: false,
    shared: true,
    collaborators: ['user-2'],
    access: 'team'
  },
  {
    id: '6',
    name: 'API Documentation',
    type: 'code',
    owner: { id: 'user-2', name: 'Alex Chen' },
    modified: '3 weeks ago',
    created: 'Sep 1, 2024',
    starred: false,
    shared: true,
    collaborators: ['user-1', 'user-3'],
    access: 'team'
  }
]

const DOCUMENT_TEMPLATES = [
  { icon: MdArticle, name: 'Blank Document', desc: 'Start from scratch' },
  { icon: MdListAlt, name: 'Meeting Notes', desc: 'Agenda, notes, action items' },
  { icon: MdNoteAlt, name: 'Project Brief', desc: 'Goals, timeline, resources' },
  { icon: MdTableChart, name: 'Spreadsheet', desc: 'Tables and calculations' },
  { icon: MdCode, name: 'Technical Doc', desc: 'Code blocks and diagrams' }
]

export const DocumentsShowcase = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortBy, setSortBy] = useState<SortBy>('modified')
  const [filterBy, setFilterBy] = useState<FilterBy>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [documents, setDocuments] = useState(DEMO_DOCUMENTS)
  const [showNewDocModal, setShowNewDocModal] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)

  const toggleStar = (id: string) => {
    setDocuments(documents.map((d) => (d.id === id ? { ...d, starred: !d.starred } : d)))
  }

  const filteredDocuments = documents
    .filter((doc) => {
      if (filterBy === 'starred') return doc.starred
      if (filterBy === 'shared') return doc.shared
      if (filterBy === 'owned') return doc.owner.id === 'user-1'
      return true
    })
    .filter(
      (doc) =>
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.owner.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      return 0 // Keep original order for modified/created (demo)
    })

  const getDocIcon = (type: Document['type']) => {
    switch (type) {
      case 'spreadsheet':
        return { icon: MdTableChart, color: 'text-emerald-500', bg: 'bg-emerald-50' }
      case 'note':
        return { icon: MdNoteAlt, color: 'text-amber-500', bg: 'bg-amber-50' }
      case 'code':
        return { icon: MdCode, color: 'text-violet-500', bg: 'bg-violet-50' }
      default:
        return { icon: MdDescription, color: 'text-primary', bg: 'bg-primary/10' }
    }
  }

  const getAccessIcon = (access: Document['access']) => {
    switch (access) {
      case 'public':
        return { icon: MdPublic, label: 'Public' }
      case 'team':
        return { icon: MdPeople, label: 'Team' }
      default:
        return { icon: MdLock, label: 'Private' }
    }
  }

  return (
    <>
      <Head>
        <title>Documents | docs.plus Showcase</title>
      </Head>
      <ShowcaseLayout title="Documents" description="Create, organize, and manage your documents.">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Sidebar */}
          <aside className="w-full shrink-0 lg:w-64">
            <div className="space-y-6 lg:sticky lg:top-24">
              {/* New Document Button */}
              <button
                onClick={() => setShowNewDocModal(true)}
                className="btn btn-primary btn-block gap-2">
                <MdAdd size={20} />
                New Document
              </button>

              {/* Quick Filters */}
              <div className="card border-base-300 bg-base-100 border">
                <div className="card-body p-4">
                  <h3 className="text-sm font-semibold">Quick Access</h3>
                  <ul className="menu gap-1 p-0">
                    {[
                      { id: 'all' as const, icon: MdDescription, label: 'All Documents' },
                      { id: 'starred' as const, icon: MdStar, label: 'Starred' },
                      { id: 'shared' as const, icon: MdPeople, label: 'Shared with me' },
                      { id: 'owned' as const, icon: MdInsertDriveFile, label: 'Owned by me' }
                    ].map((item) => (
                      <li key={item.id}>
                        <button
                          onClick={() => {
                            setFilterBy(item.id)
                            setSelectedFolder(null)
                          }}
                          className={`gap-3 ${filterBy === item.id && !selectedFolder ? 'active' : ''}`}>
                          <item.icon size={18} />
                          {item.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Folders */}
              <div className="card border-base-300 bg-base-100 border">
                <div className="card-body p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Folders</h3>
                    <button className="btn btn-ghost btn-xs btn-circle">
                      <MdAdd size={16} />
                    </button>
                  </div>
                  <ul className="menu gap-1 p-0">
                    {DEMO_FOLDERS.map((folder) => (
                      <li key={folder.id}>
                        <button
                          onClick={() => setSelectedFolder(folder.id)}
                          className={`gap-3 ${selectedFolder === folder.id ? 'active' : ''}`}>
                          <div className={`size-3 rounded ${folder.color}`} />
                          <span className="flex-1">{folder.name}</span>
                          <span className="badge badge-ghost badge-sm">{folder.count}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Storage */}
              <div className="card border-base-300 bg-base-100 border">
                <div className="card-body p-4">
                  <h3 className="text-sm font-semibold">Storage</h3>
                  <div className="mt-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-base-content/60">2.4 GB used</span>
                      <span className="text-base-content/60">15 GB</span>
                    </div>
                    <progress
                      className="progress progress-primary mt-2 w-full"
                      value="16"
                      max="100"
                    />
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <div className="min-w-0 flex-1">
            {/* Toolbar */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              {/* Search */}
              <div className="relative flex-1 sm:max-w-sm">
                <MdSearch
                  size={20}
                  className="text-base-content/40 absolute top-1/2 left-3 -translate-y-1/2"
                />
                <input
                  type="text"
                  placeholder="Search documents..."
                  className="input input-bordered w-full pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {/* Sort */}
                <div className="dropdown dropdown-end">
                  <button tabIndex={0} className="btn btn-ghost btn-sm gap-1">
                    <MdSort size={18} />
                    Sort
                  </button>
                  <ul className="dropdown-content menu bg-base-100 border-base-300 z-10 w-48 rounded-xl border p-2 shadow-lg">
                    <li>
                      <button
                        onClick={() => setSortBy('modified')}
                        className={sortBy === 'modified' ? 'active' : ''}>
                        Last modified
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => setSortBy('name')}
                        className={sortBy === 'name' ? 'active' : ''}>
                        Name
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => setSortBy('created')}
                        className={sortBy === 'created' ? 'active' : ''}>
                        Date created
                      </button>
                    </li>
                  </ul>
                </div>

                {/* View Mode */}
                <div className="join">
                  <button
                    className={`btn btn-sm join-item ${viewMode === 'grid' ? 'btn-active' : ''}`}
                    onClick={() => setViewMode('grid')}
                    aria-label="Grid view">
                    <MdGridView size={18} />
                  </button>
                  <button
                    className={`btn btn-sm join-item ${viewMode === 'list' ? 'btn-active' : ''}`}
                    onClick={() => setViewMode('list')}
                    aria-label="List view">
                    <MdViewList size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            {filteredDocuments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="bg-base-200 mb-4 flex size-16 items-center justify-center rounded-full">
                  <MdDescription size={32} className="text-base-content/40" />
                </div>
                <h3 className="text-lg font-semibold">No documents found</h3>
                <p className="text-base-content/60 mb-4 text-sm">
                  {searchQuery
                    ? 'Try a different search term.'
                    : 'Create your first document to get started.'}
                </p>
                <button onClick={() => setShowNewDocModal(true)} className="btn btn-primary gap-2">
                  <MdAdd size={18} />
                  New Document
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              /* Grid View */
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredDocuments.map((doc) => {
                  const iconData = getDocIcon(doc.type)
                  const accessData = getAccessIcon(doc.access)
                  return (
                    <div
                      key={doc.id}
                      className="card border-base-300 bg-base-100 group border transition-all hover:shadow-lg">
                      <div className="card-body p-4">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div
                            className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${iconData.bg}`}>
                            <iconData.icon size={24} className={iconData.color} />
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleStar(doc.id)}
                              className={`btn btn-ghost btn-xs btn-circle ${doc.starred ? 'text-warning' : 'opacity-0 group-hover:opacity-100'}`}>
                              {doc.starred ? <MdStar size={18} /> : <MdStarBorder size={18} />}
                            </button>
                            <div className="dropdown dropdown-end">
                              <button
                                tabIndex={0}
                                className="btn btn-ghost btn-xs btn-circle opacity-0 group-hover:opacity-100">
                                <MdMoreVert size={18} />
                              </button>
                              <ul className="dropdown-content menu bg-base-100 border-base-300 z-10 w-44 rounded-xl border p-2 shadow-lg">
                                <li>
                                  <a>
                                    <MdEdit size={16} /> Rename
                                  </a>
                                </li>
                                <li>
                                  <a>
                                    <MdShare size={16} /> Share
                                  </a>
                                </li>
                                <li>
                                  <a>
                                    <MdContentCopy size={16} /> Duplicate
                                  </a>
                                </li>
                                <li>
                                  <a>
                                    <MdDriveFileMove size={16} /> Move
                                  </a>
                                </li>
                                <li className="divider"></li>
                                <li>
                                  <a className="text-error">
                                    <MdDelete size={16} /> Delete
                                  </a>
                                </li>
                              </ul>
                            </div>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="mt-3">
                          <h4 className="truncate font-medium">{doc.name}</h4>
                          <p className="text-base-content/60 mt-1 flex items-center gap-2 text-xs">
                            <MdAccessTime size={12} />
                            {doc.modified}
                          </p>
                        </div>

                        {/* Footer */}
                        <div className="mt-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Avatar id={doc.owner.id} size="xs" clickable={false} />
                            {doc.collaborators.length > 0 && (
                              <span className="text-base-content/50 text-xs">
                                +{doc.collaborators.length}
                              </span>
                            )}
                          </div>
                          <div className="tooltip tooltip-left" data-tip={accessData.label}>
                            <accessData.icon size={16} className="text-base-content/40" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              /* List View */
              <div className="card border-base-300 bg-base-100 overflow-hidden border">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th className="hidden sm:table-cell">Owner</th>
                      <th className="hidden md:table-cell">Modified</th>
                      <th className="hidden lg:table-cell">Access</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocuments.map((doc) => {
                      const iconData = getDocIcon(doc.type)
                      const accessData = getAccessIcon(doc.access)
                      return (
                        <tr key={doc.id} className="group hover">
                          <td>
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconData.bg}`}>
                                <iconData.icon size={20} className={iconData.color} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{doc.name}</p>
                                <p className="text-base-content/60 text-xs sm:hidden">
                                  {doc.owner.name} • {doc.modified}
                                </p>
                              </div>
                              {doc.starred && (
                                <MdStar size={16} className="text-warning shrink-0" />
                              )}
                            </div>
                          </td>
                          <td className="hidden sm:table-cell">
                            <div className="flex items-center gap-2">
                              <Avatar id={doc.owner.id} size="xs" clickable={false} />
                              <span className="text-sm">{doc.owner.name}</span>
                            </div>
                          </td>
                          <td className="text-base-content/60 hidden text-sm md:table-cell">
                            {doc.modified}
                          </td>
                          <td className="hidden lg:table-cell">
                            <span className="badge badge-ghost badge-sm gap-1">
                              <accessData.icon size={12} />
                              {accessData.label}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100">
                              <button className="btn btn-ghost btn-xs btn-circle">
                                <MdShare size={16} />
                              </button>
                              <div className="dropdown dropdown-end">
                                <button tabIndex={0} className="btn btn-ghost btn-xs btn-circle">
                                  <MdMoreVert size={16} />
                                </button>
                                <ul className="dropdown-content menu bg-base-100 border-base-300 z-10 w-44 rounded-xl border p-2 shadow-lg">
                                  <li>
                                    <a>
                                      <MdEdit size={16} /> Rename
                                    </a>
                                  </li>
                                  <li>
                                    <a>
                                      <MdContentCopy size={16} /> Duplicate
                                    </a>
                                  </li>
                                  <li>
                                    <a>
                                      <MdHistory size={16} /> History
                                    </a>
                                  </li>
                                  <li className="divider"></li>
                                  <li>
                                    <a className="text-error">
                                      <MdDelete size={16} /> Delete
                                    </a>
                                  </li>
                                </ul>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* New Document Modal */}
        {showNewDocModal && (
          <div className="modal modal-open">
            <div className="modal-box max-w-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Create New Document</h3>
                <button
                  onClick={() => setShowNewDocModal(false)}
                  className="btn btn-ghost btn-sm btn-circle">
                  <MdClose size={20} />
                </button>
              </div>

              <div className="divider"></div>

              <div className="space-y-3">
                {DOCUMENT_TEMPLATES.map((template) => (
                  <button
                    key={template.name}
                    className="border-base-300 hover:border-primary hover:bg-primary/5 flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all">
                    <div className="bg-primary/10 flex size-12 shrink-0 items-center justify-center rounded-xl">
                      <template.icon size={24} className="text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{template.name}</p>
                      <p className="text-base-content/60 text-sm">{template.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="modal-action">
                <button onClick={() => setShowNewDocModal(false)} className="btn btn-ghost">
                  Cancel
                </button>
              </div>
            </div>
            <div className="modal-backdrop" onClick={() => setShowNewDocModal(false)} />
          </div>
        )}
      </ShowcaseLayout>
    </>
  )
}

export default DocumentsShowcase
