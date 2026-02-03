/**
 * DashboardTab Component
 * =======================
 * Main dashboard view with stats, documents table, and shortcuts.
 */

import {
  MdAdd,
  MdAnalytics,
  MdBookmark,
  MdChevronLeft,
  MdChevronRight,
  MdDelete,
  MdDescription,
  MdEdit,
  MdFilterList,
  MdInfo,
  MdInsertDriveFile,
  MdMoreVert,
  MdPeople,
  MdPlayArrow,
  MdShare
} from 'react-icons/md'

import { DEMO_DOCUMENTS, KEYBOARD_SHORTCUTS } from '../../constants/demoData'
import { useDesignSystem } from '../../context/DesignSystemContext'
import { StatCard } from '../cards'

export const DashboardTab = () => {
  const { currentPage, setCurrentPage, selectedRows, setSelectedRows } = useDesignSystem()

  return (
    <div className="animate-in fade-in space-y-6 duration-300">
      {/* Welcome Banner */}
      <div className="alert from-primary/10 via-primary/5 border-l-primary border-l-4 bg-gradient-to-r to-transparent">
        <MdInfo size={24} className="text-primary" aria-hidden="true" />
        <div>
          <h3 className="font-bold">Welcome to the Design System Demo!</h3>
          <p className="text-base-content/70 text-sm">
            Explore all components in this interactive dashboard. Use the sidebar to navigate.
          </p>
        </div>
        <button className="btn btn-primary btn-sm gap-1 transition-transform hover:scale-105">
          <MdPlayArrow size={16} /> Get Started
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Documents"
          value="1,284"
          change="+12%"
          trend="up"
          icon={MdDescription}
          delay={0}
        />
        <StatCard
          title="Active Users"
          value="42"
          change="+5%"
          trend="up"
          icon={MdPeople}
          delay={50}
        />
        <StatCard
          title="Views This Week"
          value="8.2K"
          change="-3%"
          trend="down"
          icon={MdAnalytics}
          delay={100}
        />
        <StatCard
          title="Bookmarks"
          value="156"
          change="+8%"
          trend="up"
          icon={MdBookmark}
          accent
          delay={150}
        />
      </div>

      {/* Recent Documents - Desktop Table / Mobile Cards */}
      <div className="card border-base-300 bg-base-100 border shadow-sm">
        <div className="card-body p-0">
          <div className="border-base-300 flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <h3 className="text-lg font-bold">Recent Documents</h3>
            <div className="flex gap-2">
              <button className="btn btn-ghost btn-sm gap-1 transition-colors">
                <MdFilterList size={18} aria-hidden="true" /> Filter
              </button>
              <button className="btn btn-primary btn-sm gap-1 transition-transform hover:scale-105">
                <MdAdd size={18} aria-hidden="true" /> New Doc
              </button>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="table" role="grid">
              <thead>
                <tr>
                  <th scope="col">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={selectedRows.length === DEMO_DOCUMENTS.length}
                      onChange={(e) =>
                        setSelectedRows(e.target.checked ? DEMO_DOCUMENTS.map((d) => d.id) : [])
                      }
                      aria-label="Select all documents"
                    />
                  </th>
                  <th scope="col">Document</th>
                  <th scope="col">Status</th>
                  <th scope="col">Modified</th>
                  <th scope="col">Views</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {DEMO_DOCUMENTS.map((doc) => (
                  <tr key={doc.id} className="hover transition-colors">
                    <th>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={selectedRows.includes(doc.id)}
                        onChange={(e) =>
                          setSelectedRows(
                            e.target.checked
                              ? [...selectedRows, doc.id]
                              : selectedRows.filter((id) => id !== doc.id)
                          )
                        }
                        aria-label={`Select ${doc.name}`}
                      />
                    </th>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="bg-base-200 group-hover:bg-primary/10 flex size-10 items-center justify-center rounded-lg transition-colors">
                          <MdInsertDriveFile
                            size={20}
                            className="text-primary"
                            aria-hidden="true"
                          />
                        </div>
                        <span className="font-medium">{doc.name}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge badge-sm transition-transform hover:scale-105 ${
                          doc.status === 'Published'
                            ? 'badge-success'
                            : doc.status === 'Draft'
                              ? 'badge-ghost'
                              : 'badge-warning'
                        }`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="text-base-content/70">{doc.modified}</td>
                    <td className="text-base-content/70">{doc.views}</td>
                    <th>
                      <div className="flex gap-1">
                        <button
                          className="btn btn-ghost btn-xs hover:text-primary transition-colors"
                          aria-label={`Edit ${doc.name}`}>
                          <MdEdit size={16} aria-hidden="true" />
                        </button>
                        <button
                          className="btn btn-ghost btn-xs hover:text-primary transition-colors"
                          aria-label={`Share ${doc.name}`}>
                          <MdShare size={16} aria-hidden="true" />
                        </button>
                        <button
                          className="btn btn-ghost btn-xs text-error hover:bg-error/10 transition-colors"
                          aria-label={`Delete ${doc.name}`}>
                          <MdDelete size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </th>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-3 p-4 md:hidden">
            {DEMO_DOCUMENTS.map((doc) => (
              <div
                key={doc.id}
                className="bg-base-200/50 hover:bg-base-200 flex items-center gap-3 rounded-xl p-3 transition-colors">
                <div className="bg-primary/10 flex size-12 shrink-0 items-center justify-center rounded-lg">
                  <MdInsertDriveFile size={24} className="text-primary" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{doc.name}</p>
                  <div className="text-base-content/60 mt-1 flex items-center gap-2 text-xs">
                    <span
                      className={`badge badge-xs ${
                        doc.status === 'Published'
                          ? 'badge-success'
                          : doc.status === 'Draft'
                            ? 'badge-ghost'
                            : 'badge-warning'
                      }`}>
                      {doc.status}
                    </span>
                    <span>•</span>
                    <span>{doc.modified}</span>
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-circle btn-sm"
                  aria-label={`More options for ${doc.name}`}>
                  <MdMoreVert size={20} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="border-base-300 flex flex-col items-center justify-between gap-3 border-t p-4 sm:flex-row">
            <p className="text-base-content/60 text-sm">Showing 1-4 of 24 documents</p>
            <div className="join" role="navigation" aria-label="Pagination">
              <button
                className="btn btn-sm join-item transition-colors"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page">
                <MdChevronLeft size={18} aria-hidden="true" />
              </button>
              {[1, 2, 3].map((page) => (
                <button
                  key={page}
                  className={`btn btn-sm join-item transition-all ${currentPage === page ? 'btn-active' : ''}`}
                  onClick={() => setCurrentPage(page)}
                  aria-label={`Page ${page}`}
                  aria-current={currentPage === page ? 'page' : undefined}>
                  {page}
                </button>
              ))}
              <button
                className="btn btn-sm join-item transition-colors"
                onClick={() => setCurrentPage(Math.min(3, currentPage + 1))}
                disabled={currentPage === 3}
                aria-label="Next page">
                <MdChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="card border-base-300 bg-base-100 border shadow-sm">
        <div className="card-body">
          <h3 className="card-title text-base">Keyboard Shortcuts</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {KEYBOARD_SHORTCUTS.map((shortcut, i) => (
              <div
                key={i}
                className="bg-base-200 hover:bg-base-300 flex items-center justify-between rounded-lg px-3 py-2 transition-colors">
                <span className="text-sm">{shortcut.label}</span>
                <div className="flex gap-1">
                  {shortcut.keys.map((key, j) => (
                    <kbd key={j} className="kbd kbd-sm">
                      {key}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
