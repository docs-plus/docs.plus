/**
 * Editor Components Section
 * =========================
 * DocsPlus-specific editor UI components.
 */

import {
  MdFormatBold,
  MdFormatItalic,
  MdFormatUnderlined,
  MdCode,
  MdLink,
  MdFormatListBulleted,
  MdFormatQuote,
  MdUndo,
  MdRedo,
  MdImage,
  MdTableChart,
  MdMoreVert,
  MdPeople,
  MdShare,
  MdComment,
  MdEdit,
  MdHistory,
  MdKeyboardArrowDown
} from 'react-icons/md'
import { SectionHeader, CodeBlock, ComponentCard } from '../shared'
import { Avatar } from '@components/ui'

export const EditorComponentsSection = () => {
  return (
    <div className="space-y-16">
      {/* Toolbar */}
      <section id="toolbar">
        <SectionHeader
          id="toolbar-header"
          title="Editor Toolbar"
          description="Formatting controls and document actions"
          icon={MdFormatBold}
        />

        <div className="space-y-6">
          {/* Toolbar Preview */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
              <span className="text-sm font-semibold text-slate-700">Toolbar Preview</span>
            </div>
            <div className="flex flex-wrap items-center gap-1 p-2">
              {/* Undo/Redo */}
              <div className="flex items-center">
                <button className="btn btn-ghost btn-sm btn-square">
                  <MdUndo size={18} />
                </button>
                <button className="btn btn-ghost btn-sm btn-square">
                  <MdRedo size={18} />
                </button>
              </div>

              <div className="mx-1 h-6 w-px bg-slate-200" />

              {/* Text Formatting */}
              <div className="flex items-center">
                <button className="btn btn-ghost btn-sm btn-square">
                  <MdFormatBold size={18} />
                </button>
                <button className="btn btn-ghost btn-sm btn-square">
                  <MdFormatItalic size={18} />
                </button>
                <button className="btn btn-ghost btn-sm btn-square">
                  <MdFormatUnderlined size={18} />
                </button>
                <button className="btn btn-ghost btn-sm btn-square">
                  <MdCode size={18} />
                </button>
              </div>

              <div className="mx-1 h-6 w-px bg-slate-200" />

              {/* Block Formatting */}
              <div className="flex items-center">
                <button className="btn btn-ghost btn-sm btn-square">
                  <MdFormatListBulleted size={18} />
                </button>
                <button className="btn btn-ghost btn-sm btn-square">
                  <MdFormatQuote size={18} />
                </button>
              </div>

              <div className="mx-1 h-6 w-px bg-slate-200" />

              {/* Insert */}
              <div className="flex items-center">
                <button className="btn btn-ghost btn-sm btn-square">
                  <MdLink size={18} />
                </button>
                <button className="btn btn-ghost btn-sm btn-square">
                  <MdImage size={18} />
                </button>
                <button className="btn btn-ghost btn-sm btn-square">
                  <MdTableChart size={18} />
                </button>
              </div>

              <div className="mx-1 h-6 w-px bg-slate-200" />

              <button className="btn btn-ghost btn-sm btn-square">
                <MdMoreVert size={18} />
              </button>
            </div>
          </div>

          <CodeBlock
            title="Toolbar Button Pattern"
            code={`// Toolbar button group with dividers
<div className="flex items-center">
  <button className="btn btn-ghost btn-sm btn-square">
    <MdFormatBold size={18} />
  </button>
  <button className="btn btn-ghost btn-sm btn-square">
    <MdFormatItalic size={18} />
  </button>
</div>

{/* Divider */}
<div className="mx-1 h-6 w-px bg-slate-200" />`}
          />

          <div className="rounded-xl bg-blue-50 p-4">
            <h4 className="mb-2 font-semibold text-blue-800">💡 Toolbar Guidelines</h4>
            <ul className="space-y-1 text-sm text-blue-700">
              <li>
                • Use <code className="rounded bg-blue-100 px-1">btn-ghost btn-sm btn-square</code>{' '}
                for icon buttons
              </li>
              <li>• Group related actions with vertical dividers</li>
              <li>
                • Use <code className="rounded bg-blue-100 px-1">tooltip</code> for button labels
              </li>
              <li>
                • Active state: <code className="rounded bg-blue-100 px-1">bg-slate-100</code>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Formatting Controls */}
      <section id="formatting">
        <SectionHeader
          id="formatting-header"
          title="Formatting Controls"
          description="Dropdowns for headings, fonts, and styles"
          icon={MdKeyboardArrowDown}
        />

        <ComponentCard
          title="Heading Selector"
          code={`<details className="dropdown">
  <summary className="btn btn-ghost btn-sm gap-1">
    <span>Heading 1</span>
    <MdKeyboardArrowDown size={16} />
  </summary>
  <ul className="menu dropdown-content z-20 w-40 rounded-lg bg-white p-1 shadow-lg">
    <li><button className="text-2xl font-bold">Heading 1</button></li>
    <li><button className="text-xl font-bold">Heading 2</button></li>
    <li><button className="text-lg font-semibold">Heading 3</button></li>
    <li><button>Normal text</button></li>
  </ul>
</details>`}>
          <details className="dropdown">
            <summary className="btn btn-ghost btn-sm gap-1">
              <span>Heading 1</span>
              <MdKeyboardArrowDown size={16} />
            </summary>
            <ul className="menu dropdown-content z-20 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
              <li>
                <button className="text-xl font-bold">Heading 1</button>
              </li>
              <li>
                <button className="text-lg font-bold">Heading 2</button>
              </li>
              <li>
                <button className="font-semibold">Heading 3</button>
              </li>
              <li>
                <button>Normal text</button>
              </li>
            </ul>
          </details>
        </ComponentCard>
      </section>

      {/* Comments & Mentions */}
      <section id="comments">
        <SectionHeader
          id="comments-header"
          title="Comments & Mentions"
          description="Inline comments, threads, and @mentions"
          icon={MdComment}
        />

        <div className="space-y-6">
          {/* Comment Thread Preview */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
              <span className="text-sm font-semibold text-slate-700">Comment Thread</span>
            </div>
            <div className="p-4">
              <div className="space-y-4">
                <div className="flex gap-3">
                  <Avatar id="comment-1" size="sm" clickable={false} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">Sarah Miller</span>
                      <span className="text-xs text-slate-400">2 hours ago</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      Can we add more details to this section?
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 pl-10">
                  <Avatar id="comment-2" size="sm" clickable={false} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">Alex Chen</span>
                      <span className="text-xs text-slate-400">1 hour ago</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">Sure! I&apos;ll update it by EOD.</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <input
                  type="text"
                  placeholder="Reply..."
                  className="flex-1 bg-transparent text-sm outline-none"
                />
                <button className="btn btn-primary btn-xs">Reply</button>
              </div>
            </div>
          </div>

          {/* Mention Chip */}
          <ComponentCard
            title="Mention Chip"
            code={`<span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-sm font-medium text-primary">
  @username
</span>`}>
            <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium">
              @sarah.miller
            </span>
            <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium">
              @alex.chen
            </span>
          </ComponentCard>
        </div>
      </section>

      {/* Document Title */}
      <section id="doc-title">
        <SectionHeader
          id="doc-title-header"
          title="Document Title"
          description="Editable document title field"
          icon={MdEdit}
        />

        <ComponentCard
          title="Document Title Field"
          code={`<input
  type="text"
  className="w-full border-none bg-transparent text-2xl font-bold text-slate-800 outline-none placeholder:text-slate-300 sm:text-3xl"
  placeholder="Untitled Document"
  value={title}
  onChange={(e) => setTitle(e.target.value)}
/>`}>
          <input
            type="text"
            className="w-full border-none bg-transparent text-2xl font-bold text-slate-800 outline-none placeholder:text-slate-300"
            placeholder="Untitled Document"
            defaultValue="Product Requirements Document"
          />
        </ComponentCard>
      </section>

      {/* Presence Avatars */}
      <section id="presence-avatars">
        <SectionHeader
          id="presence-avatars-header"
          title="Presence Avatars"
          description="Show who's currently viewing the document"
          icon={MdPeople}
        />

        <ComponentCard
          title="Avatar Stack"
          description="Overlapping avatars for active users"
          code={`import AvatarStack from '@components/AvatarStack'

<AvatarStack users={activeUsers} size="sm" maxDisplay={4} />`}
          importStatement="import AvatarStack from '@components/AvatarStack'">
          <div className="flex -space-x-2">
            <Avatar id="presence-1" size="sm" clickable={false} className="ring-2 ring-white" />
            <Avatar id="presence-2" size="sm" clickable={false} className="ring-2 ring-white" />
            <Avatar id="presence-3" size="sm" clickable={false} className="ring-2 ring-white" />
            <div className="flex size-8 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-white ring-2 ring-white">
              +3
            </div>
          </div>
        </ComponentCard>
      </section>

      {/* Share Modal */}
      <section id="share-modal">
        <SectionHeader
          id="share-modal-header"
          title="Share Modal"
          description="Document sharing and permission controls"
          icon={MdShare}
        />

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
            <span className="text-sm font-semibold text-slate-700">Share Modal Preview</span>
          </div>
          <div className="p-6">
            <h3 className="text-lg font-bold text-slate-800">Share Document</h3>
            <p className="text-sm text-slate-500">Invite people to collaborate</p>

            <div className="mt-4 flex gap-2">
              <input
                type="email"
                placeholder="Enter email address"
                className="input input-bordered flex-1"
              />
              <button className="btn btn-primary">Invite</button>
            </div>

            <div className="mt-6">
              <p className="mb-2 text-sm font-medium text-slate-700">People with access</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2">
                  <div className="flex items-center gap-2">
                    <Avatar id="share-1" size="sm" clickable={false} />
                    <div>
                      <p className="text-sm font-medium text-slate-800">You</p>
                      <p className="text-xs text-slate-500">owner</p>
                    </div>
                  </div>
                  <span className="badge badge-primary badge-sm">Owner</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2">
                  <div className="flex items-center gap-2">
                    <Avatar id="share-2" size="sm" clickable={false} />
                    <div>
                      <p className="text-sm font-medium text-slate-800">Sarah Miller</p>
                      <p className="text-xs text-slate-500">sarah@example.com</p>
                    </div>
                  </div>
                  <select className="select select-ghost select-sm">
                    <option>Can edit</option>
                    <option>Can view</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Version History */}
      <section id="version-history">
        <SectionHeader
          id="version-history-header"
          title="Version History"
          description="Document version list and restore controls"
          icon={MdHistory}
        />

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
            <span className="text-sm font-semibold text-slate-700">Version History List</span>
          </div>
          <div className="divide-y divide-slate-100">
            <div className="flex items-center justify-between p-4 transition-colors hover:bg-slate-50">
              <div className="flex items-center gap-3">
                <Avatar id="version-1" size="sm" clickable={false} />
                <div>
                  <p className="text-sm font-medium text-slate-800">Current version</p>
                  <p className="text-xs text-slate-500">Alex Chen • 5 minutes ago</p>
                </div>
              </div>
              <span className="badge badge-success badge-sm">Current</span>
            </div>
            <div className="flex items-center justify-between p-4 transition-colors hover:bg-slate-50">
              <div className="flex items-center gap-3">
                <Avatar id="version-2" size="sm" clickable={false} />
                <div>
                  <p className="text-sm font-medium text-slate-800">Added feature requirements</p>
                  <p className="text-xs text-slate-500">Sarah Miller • 2 hours ago</p>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm">Restore</button>
            </div>
            <div className="flex items-center justify-between p-4 transition-colors hover:bg-slate-50">
              <div className="flex items-center gap-3">
                <Avatar id="version-3" size="sm" clickable={false} />
                <div>
                  <p className="text-sm font-medium text-slate-800">Initial draft</p>
                  <p className="text-xs text-slate-500">You • Yesterday</p>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm">Restore</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
