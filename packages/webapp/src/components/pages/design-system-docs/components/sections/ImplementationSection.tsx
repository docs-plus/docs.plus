/**
 * Implementation Section
 * ======================
 * File structure, naming conventions, and contributing guidelines.
 */

import { MdFolder, MdTextFormat, MdGroupWork } from 'react-icons/md'
import { SectionHeader, CodeBlock } from '../shared'

export const ImplementationSection = () => {
  return (
    <div className="space-y-16">
      {/* File Structure */}
      <section id="file-structure">
        <SectionHeader
          id="file-structure-header"
          title="File Structure"
          description="Where to find tokens, components, and patterns"
          icon={MdFolder}
        />

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
            <span className="text-sm font-semibold text-slate-700">Project Structure</span>
          </div>
          <pre className="overflow-x-auto p-4 text-sm text-slate-700">
            {`packages/webapp/src/
├── components/
│   ├── ui/                    # Reusable UI primitives
│   │   ├── Avatar.tsx
│   │   ├── Button.tsx
│   │   ├── CloseButton.tsx
│   │   ├── Dialog.tsx
│   │   ├── Input.tsx
│   │   ├── PanelHeader.tsx
│   │   ├── Popover.tsx
│   │   ├── ScrollArea.tsx
│   │   └── index.ts           # Barrel exports
│   │
│   ├── skeleton/              # Loading skeletons
│   │   ├── AvatarStackLoader.tsx
│   │   ├── DocumentSkeleton.tsx
│   │   └── ...
│   │
│   ├── pages/                 # Page-specific components
│   │   ├── design-system/     # Design system demo
│   │   └── document/          # Document editor
│   │
│   └── [feature]/             # Feature components
│       ├── FeatureName.tsx
│       ├── types.ts
│       ├── index.ts
│       └── hooks/
│
├── styles/
│   └── globals.scss           # Tailwind + daisyUI config
│
├── hooks/                     # Global custom hooks
├── stores/                    # Zustand state
└── types/                     # Global TypeScript types`}
          </pre>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="mb-2 font-semibold text-slate-800">Token Location</h4>
            <code className="block rounded bg-slate-100 p-2 text-xs text-slate-700">
              src/styles/globals.scss
            </code>
            <p className="mt-2 text-sm text-slate-500">
              Theme colors defined via{' '}
              <code className="rounded bg-slate-100 px-1">@plugin &apos;daisyui/theme&apos;</code>
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="mb-2 font-semibold text-slate-800">Components Location</h4>
            <code className="block rounded bg-slate-100 p-2 text-xs text-slate-700">
              src/components/ui/
            </code>
            <p className="mt-2 text-sm text-slate-500">
              Import via <code className="rounded bg-slate-100 px-1">@components/ui</code>
            </p>
          </div>
        </div>
      </section>

      {/* Naming Conventions */}
      <section id="naming-conventions">
        <SectionHeader
          id="naming-conventions-header"
          title="Naming Conventions"
          description="Consistent naming for files, components, and tokens"
          icon={MdTextFormat}
        />

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-700">Type</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Convention</th>
                <th className="hidden px-4 py-3 font-semibold text-slate-700 sm:table-cell">
                  Example
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              <tr>
                <td className="px-4 py-3 font-medium text-slate-800">Components</td>
                <td className="px-4 py-3 text-slate-600">PascalCase</td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <code className="rounded bg-slate-100 px-1">ProfilePanel.tsx</code>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-800">Hooks</td>
                <td className="px-4 py-3 text-slate-600">camelCase with &apos;use&apos;</td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <code className="rounded bg-slate-100 px-1">useProfileUpdate.ts</code>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-800">Utilities</td>
                <td className="px-4 py-3 text-slate-600">camelCase</td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <code className="rounded bg-slate-100 px-1">formatDate.ts</code>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-800">Types</td>
                <td className="px-4 py-3 text-slate-600">PascalCase</td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <code className="rounded bg-slate-100 px-1">UserProfile</code>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-800">Constants</td>
                <td className="px-4 py-3 text-slate-600">SCREAMING_SNAKE_CASE</td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <code className="rounded bg-slate-100 px-1">API_ENDPOINTS</code>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-800">Pages</td>
                <td className="px-4 py-3 text-slate-600">kebab-case</td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <code className="rounded bg-slate-100 px-1">design-system.tsx</code>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6">
          <CodeBlock
            title="Component Structure Pattern"
            code={`import { useState } from 'react'
import { useRouter } from 'next/router'
import { useStore, useAuthStore } from '@stores'

interface MyComponentProps {
  id: string
  title?: string
}

const MyComponent = ({ id, title }: MyComponentProps) => {
  // Hooks
  const router = useRouter()
  const user = useAuthStore((state) => state.profile)

  // State
  const [isOpen, setIsOpen] = useState(false)

  // Handlers
  const handleAction = () => { /* ... */ }

  // Render
  return (
    <div>
      {/* Component JSX */}
    </div>
  )
}

export default MyComponent`}
          />
        </div>
      </section>

      {/* Contributing */}
      <section id="contributing">
        <SectionHeader
          id="contributing-header"
          title="Contributing"
          description="How to add new components and maintain consistency"
          icon={MdGroupWork}
        />

        <div className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h3 className="font-semibold text-slate-700">Adding a New Component</h3>
            </div>
            <div className="divide-y divide-slate-100">
              <div className="flex items-start gap-4 p-4">
                <div className="bg-primary flex size-8 shrink-0 items-center justify-center rounded-full font-bold text-white">
                  1
                </div>
                <div>
                  <h4 className="font-medium text-slate-800">Check if it exists</h4>
                  <p className="text-sm text-slate-500">
                    Review the Component Inventory in the design system docs and check{' '}
                    <code className="rounded bg-slate-100 px-1">@components/ui</code>.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4">
                <div className="bg-primary flex size-8 shrink-0 items-center justify-center rounded-full font-bold text-white">
                  2
                </div>
                <div>
                  <h4 className="font-medium text-slate-800">Follow design system rules</h4>
                  <p className="text-sm text-slate-500">
                    Use semantic colors, spacing tokens, and existing patterns. Don&apos;t invent
                    new styling.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4">
                <div className="bg-primary flex size-8 shrink-0 items-center justify-center rounded-full font-bold text-white">
                  3
                </div>
                <div>
                  <h4 className="font-medium text-slate-800">Add TypeScript types</h4>
                  <p className="text-sm text-slate-500">
                    Define and export prop interfaces. Document with JSDoc comments.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4">
                <div className="bg-primary flex size-8 shrink-0 items-center justify-center rounded-full font-bold text-white">
                  4
                </div>
                <div>
                  <h4 className="font-medium text-slate-800">Export from barrel file</h4>
                  <p className="text-sm text-slate-500">
                    Add to <code className="rounded bg-slate-100 px-1">index.ts</code> for clean
                    imports.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4">
                <div className="bg-primary flex size-8 shrink-0 items-center justify-center rounded-full font-bold text-white">
                  5
                </div>
                <div>
                  <h4 className="font-medium text-slate-800">Document in design system</h4>
                  <p className="text-sm text-slate-500">
                    Add component preview, code example, and usage guidelines.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-amber-50 p-4">
            <h4 className="mb-2 font-semibold text-amber-800">⚠️ Migration Notes</h4>
            <ul className="space-y-1 text-sm text-amber-700">
              <li>
                • <strong>Tailwind v4</strong>: No tailwind.config.js - use CSS-based config in
                globals.scss
              </li>
              <li>
                • <strong>daisyUI v5</strong>: Check upgrade guide for class name changes
              </li>
              <li>
                • <strong>Page Router</strong>: Don&apos;t use{' '}
                <code className="rounded bg-amber-100 px-1">&quot;use client&quot;</code> directive
              </li>
              <li>
                • <strong>TypeScript strict</strong>: All code must be properly typed
              </li>
            </ul>
          </div>

          <div className="rounded-xl bg-emerald-50 p-4">
            <h4 className="mb-2 font-semibold text-emerald-800">✓ Code Review Checklist</h4>
            <ul className="space-y-1 text-sm text-emerald-700">
              <li>• Uses design tokens (no hardcoded colors)</li>
              <li>• Follows mobile-first responsive design</li>
              <li>• Has proper TypeScript types</li>
              <li>• Reuses existing components where possible</li>
              <li>• Follows naming conventions</li>
              <li>• Accessible (keyboard nav, ARIA, focus)</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
