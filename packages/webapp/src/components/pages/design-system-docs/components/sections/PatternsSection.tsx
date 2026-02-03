/**
 * Patterns Section
 * ================
 * Layout, empty states, loading, error, confirmation, collaboration patterns.
 */

import { Avatar } from '@components/ui'
import {
  MdCheckCircle,
  MdDashboard,
  MdErrorOutline,
  MdHelpOutline,
  MdHourglassEmpty,
  MdInbox,
  MdPeople
} from 'react-icons/md'

import { CodeBlock, SectionHeader } from '../shared'

export const PatternsSection = () => {
  return (
    <div className="space-y-16">
      {/* Layout Patterns */}
      <section id="layout-patterns">
        <SectionHeader
          id="layout-patterns-header"
          title="Layout Patterns"
          description="Page layouts, sidebars, and content areas"
          icon={MdDashboard}
        />

        <div className="space-y-6">
          <CodeBlock
            title="Full-Height Page Shell"
            code={`<div className="flex min-h-[100dvh] flex-col">
  <header className="shrink-0">...</header>
  <main className="flex-1">...</main>
  <footer className="shrink-0">...</footer>
</div>`}
          />

          <CodeBlock
            title="Sidebar + Content Panel"
            code={`<div className="flex h-[100dvh] flex-col md:flex-row md:overflow-hidden">
  {/* Sidebar */}
  <aside className="w-full shrink-0 border-slate-200 md:w-72 md:border-r lg:w-80">
    <ScrollArea className="flex-1 p-4">
      {/* Navigation */}
    </ScrollArea>
  </aside>

  {/* Content */}
  <main className="min-h-0 flex-1">
    <ScrollArea className="h-full p-4 sm:p-6">
      {/* Content */}
    </ScrollArea>
  </main>
</div>`}
          />

          <div className="rounded-xl bg-blue-50 p-4">
            <h4 className="mb-2 font-semibold text-blue-800">💡 Layout Rules</h4>
            <ul className="space-y-1 text-sm text-blue-700">
              <li>
                • Use <code className="rounded bg-blue-100 px-1">100dvh</code> for full-height
                layouts (not <code className="rounded bg-blue-100 px-1">100vh</code>)
              </li>
              <li>
                • Sidebars: <code className="rounded bg-blue-100 px-1">md:w-72 lg:w-80</code>
              </li>
              <li>
                • Content max-width: <code className="rounded bg-blue-100 px-1">max-w-2xl</code> for
                readability
              </li>
              <li>
                • Always use <code className="rounded bg-blue-100 px-1">ScrollArea</code> for
                scrollable content
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Empty States */}
      <section id="empty-states">
        <SectionHeader
          id="empty-states-header"
          title="Empty States"
          description="Helpful UI when there's no content"
          icon={MdInbox}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* No Documents */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
              <span className="text-sm font-semibold text-slate-700">No Documents</span>
            </div>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-slate-100">
                <MdInbox size={32} className="text-slate-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-slate-800">No documents yet</h3>
              <p className="mb-6 max-w-xs text-sm text-slate-500">
                Create your first document to get started with collaborative editing.
              </p>
              <button className="btn btn-primary gap-2">Create Document</button>
            </div>
          </div>

          {/* No Search Results */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
              <span className="text-sm font-semibold text-slate-700">No Search Results</span>
            </div>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-slate-100">
                <MdHelpOutline size={32} className="text-slate-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-slate-800">No results found</h3>
              <p className="mb-6 max-w-xs text-sm text-slate-500">
                Try adjusting your search terms or filters.
              </p>
              <button className="btn btn-ghost">Clear filters</button>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <CodeBlock
            title="Empty State Pattern"
            code={`<div className="flex flex-col items-center justify-center py-12 text-center">
  {/* Icon */}
  <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-slate-100">
    <MdInbox size={32} className="text-slate-400" />
  </div>

  {/* Title */}
  <h3 className="mb-2 text-lg font-semibold text-slate-800">No documents yet</h3>

  {/* Description */}
  <p className="mb-6 max-w-sm text-sm text-slate-500">
    Create your first document to get started.
  </p>

  {/* Action (optional) */}
  <button className="btn btn-primary gap-2">
    <MdAdd size={20} />
    Create Document
  </button>
</div>`}
          />
        </div>
      </section>

      {/* Loading Patterns */}
      <section id="loading-patterns">
        <SectionHeader
          id="loading-patterns-header"
          title="Loading Patterns"
          description="Skeleton loaders and loading indicators"
          icon={MdHourglassEmpty}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Document List Skeleton */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
              <span className="text-sm font-semibold text-slate-700">Document List Skeleton</span>
            </div>
            <div className="space-y-4 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton size-10 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-3/4" />
                    <div className="skeleton h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Content Skeleton */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
              <span className="text-sm font-semibold text-slate-700">Content Skeleton</span>
            </div>
            <div className="space-y-4 p-4">
              <div className="skeleton h-8 w-3/5" />
              <div className="space-y-2">
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-4/5" />
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-3/5" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-blue-50 p-4">
          <h4 className="mb-2 font-semibold text-blue-800">💡 Skeleton Best Practices</h4>
          <ul className="space-y-1 text-sm text-blue-700">
            <li>• Match the actual content layout</li>
            <li>
              • Vary line widths: <code className="rounded bg-blue-100 px-1">w-full</code>,{' '}
              <code className="rounded bg-blue-100 px-1">w-4/5</code>,{' '}
              <code className="rounded bg-blue-100 px-1">w-3/5</code>
            </li>
            <li>
              • Use <code className="rounded bg-blue-100 px-1">skeleton</code> class from daisyUI
            </li>
            <li>• Fill the viewport on large screens (min 5 sections)</li>
          </ul>
        </div>
      </section>

      {/* Error States */}
      <section id="error-states">
        <SectionHeader
          id="error-states-header"
          title="Error States"
          description="Error messages and recovery options"
          icon={MdErrorOutline}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Page Error */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
              <span className="text-sm font-semibold text-slate-700">Full Page Error</span>
            </div>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-error/10 mb-4 flex size-16 items-center justify-center rounded-full">
                <MdErrorOutline size={32} className="text-error" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-slate-800">Something went wrong</h3>
              <p className="mb-6 max-w-xs text-sm text-slate-500">
                We couldn&apos;t load this page. Please try again.
              </p>
              <div className="flex gap-3">
                <button className="btn btn-ghost">Go Back</button>
                <button className="btn btn-primary">Try Again</button>
              </div>
            </div>
          </div>

          {/* Inline Error */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
              <span className="text-sm font-semibold text-slate-700">Inline Error</span>
            </div>
            <div className="p-4">
              <div className="border-error/30 bg-error/5 rounded-xl border p-6 text-center">
                <MdErrorOutline size={24} className="text-error mx-auto mb-2" />
                <p className="text-error text-sm">Failed to load comments</p>
                <button className="btn btn-ghost btn-sm mt-2">Retry</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Confirmation Dialogs */}
      <section id="confirmation-dialogs">
        <SectionHeader
          id="confirmation-dialogs-header"
          title="Confirmation Dialogs"
          description="Confirm destructive or important actions"
          icon={MdHelpOutline}
        />

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
            <span className="text-sm font-semibold text-slate-700">Delete Confirmation</span>
          </div>
          <div className="mx-auto max-w-sm p-6">
            <div className="bg-error/10 mb-4 flex size-12 items-center justify-center rounded-full">
              <MdErrorOutline size={24} className="text-error" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Delete document?</h3>
            <p className="mt-2 text-sm text-slate-500">
              This action cannot be undone. The document and all its comments will be permanently
              deleted.
            </p>
            <div className="mt-6 flex gap-3">
              <button className="btn btn-ghost flex-1">Cancel</button>
              <button className="btn btn-error flex-1">Delete</button>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-amber-50 p-4">
          <h4 className="mb-2 font-semibold text-amber-800">⚠️ Confirmation Rules</h4>
          <ul className="space-y-1 text-sm text-amber-700">
            <li>• Always confirm destructive actions (delete, remove, discard)</li>
            <li>
              • Use <code className="rounded bg-amber-100 px-1">btn-error</code> for destructive
              action button
            </li>
            <li>• Place Cancel before destructive action</li>
            <li>• Be specific about what will happen</li>
          </ul>
        </div>
      </section>

      {/* Collaboration Patterns */}
      <section id="collaboration">
        <SectionHeader
          id="collaboration-header"
          title="Collaboration Patterns"
          description="Presence, permissions, and notifications"
          icon={MdPeople}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Presence Indicator */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
              <span className="text-sm font-semibold text-slate-700">Active Users</span>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                  <Avatar id="collab-1" size="sm" clickable={false} className="ring-2 ring-white" />
                  <Avatar id="collab-2" size="sm" clickable={false} className="ring-2 ring-white" />
                  <Avatar id="collab-3" size="sm" clickable={false} className="ring-2 ring-white" />
                </div>
                <span className="text-sm text-slate-500">3 people editing</span>
              </div>
            </div>
          </div>

          {/* Permission Change */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
              <span className="text-sm font-semibold text-slate-700">Permission Notification</span>
            </div>
            <div className="p-4">
              <div className="rounded-lg bg-blue-50 p-3">
                <div className="flex items-center gap-2">
                  <MdCheckCircle size={18} className="text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">
                    Sarah now has edit access
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Form Validation */}
      <section id="form-validation">
        <SectionHeader
          id="form-validation-header"
          title="Form Validation"
          description="Input validation and error display"
          icon={MdCheckCircle}
        />

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
            <span className="text-sm font-semibold text-slate-700">Validation States</span>
          </div>
          <div className="space-y-4 p-4">
            {/* Valid */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Email (valid)</span>
              </label>
              <input
                type="email"
                className="input input-bordered input-success pr-10"
                value="user@example.com"
                readOnly
              />
              <label className="label">
                <span className="label-text-alt text-success">Looks good!</span>
              </label>
            </div>

            {/* Invalid */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Username (invalid)</span>
              </label>
              <input
                type="text"
                className="input input-bordered input-error pr-10"
                value="ab"
                readOnly
              />
              <label className="label">
                <span className="label-text-alt text-error">
                  Username must be at least 3 characters
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-blue-50 p-4">
          <h4 className="mb-2 font-semibold text-blue-800">💡 Validation Rules</h4>
          <ul className="space-y-1 text-sm text-blue-700">
            <li>• Validate on blur, not while typing</li>
            <li>• Show success state for valid inputs</li>
            <li>• Error messages should be specific and helpful</li>
            <li>
              • Use <code className="rounded bg-blue-100 px-1">input-success</code> /{' '}
              <code className="rounded bg-blue-100 px-1">input-error</code> classes
            </li>
          </ul>
        </div>
      </section>
    </div>
  )
}
