/**
 * Getting Started Section
 * =======================
 * Introduction, how to use, and tech stack.
 */

import {
  MdRocketLaunch,
  MdPalette,
  MdWidgets,
  MdPattern,
  MdCheckCircle,
  MdCode
} from 'react-icons/md'
import { SectionHeader, CodeBlock } from '../shared'

export const GettingStartedSection = () => {
  return (
    <div className="space-y-12">
      {/* Introduction */}
      <section id="introduction">
        <SectionHeader
          id="introduction-header"
          title="DocsPlus Design System"
          description="A comprehensive design handbook for building consistent UI"
          icon={MdRocketLaunch}
        />

        <div className="prose prose-slate max-w-none">
          <p className="text-lg text-slate-600">
            The DocsPlus Design System provides design tokens, components, and patterns to help
            engineers build consistent, accessible, and beautiful UI for our collaborative document
            editor.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <MdPalette size={24} className="text-primary mb-2" />
              <h3 className="font-semibold text-slate-800">Design Tokens</h3>
              <p className="text-sm text-slate-500">
                Colors, typography, spacing, and motion values
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <MdWidgets size={24} className="text-primary mb-2" />
              <h3 className="font-semibold text-slate-800">Components</h3>
              <p className="text-sm text-slate-500">
                Buttons, inputs, modals, and editor-specific UI
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <MdPattern size={24} className="text-primary mb-2" />
              <h3 className="font-semibold text-slate-800">Patterns</h3>
              <p className="text-sm text-slate-500">Layout, loading, error states, and workflows</p>
            </div>
          </div>
        </div>
      </section>

      {/* How to Use */}
      <section id="how-to-use">
        <SectionHeader
          id="how-to-use-header"
          title="How to Use"
          description="Three steps to consistent UI"
          icon={MdCheckCircle}
        />

        <div className="space-y-4">
          <div className="flex gap-4 rounded-xl border border-slate-100 bg-white p-4">
            <div className="bg-primary flex size-8 shrink-0 items-center justify-center rounded-full font-bold text-white">
              1
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Use Design Tokens</h3>
              <p className="text-sm text-slate-500">
                Always use semantic color classes (
                <code className="rounded bg-slate-100 px-1">bg-primary</code>,{' '}
                <code className="rounded bg-slate-100 px-1">text-base-content</code>) instead of
                hardcoded colors. This ensures consistency across light and dark themes.
              </p>
            </div>
          </div>

          <div className="flex gap-4 rounded-xl border border-slate-100 bg-white p-4">
            <div className="bg-primary flex size-8 shrink-0 items-center justify-center rounded-full font-bold text-white">
              2
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Use Existing Components</h3>
              <p className="text-sm text-slate-500">
                Check the component inventory before creating new components. Use{' '}
                <code className="rounded bg-slate-100 px-1">@components/ui</code> for primitives and
                extend existing components when possible.
              </p>
            </div>
          </div>

          <div className="flex gap-4 rounded-xl border border-slate-100 bg-white p-4">
            <div className="bg-primary flex size-8 shrink-0 items-center justify-center rounded-full font-bold text-white">
              3
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Follow Patterns</h3>
              <p className="text-sm text-slate-500">
                Use established patterns for layouts, loading states, error handling, and
                collaboration UI. This ensures a consistent user experience across the app.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section id="tech-stack">
        <SectionHeader
          id="tech-stack-header"
          title="Tech Stack"
          description="Core technologies and configurations"
          icon={MdCode}
        />

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-700">Technology</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Version</th>
                <th className="hidden px-4 py-3 font-semibold text-slate-700 sm:table-cell">
                  Purpose
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-3 font-medium text-slate-800">Tailwind CSS</td>
                <td className="px-4 py-3 text-slate-600">4.1.x</td>
                <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">Utility-first CSS</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-800">daisyUI</td>
                <td className="px-4 py-3 text-slate-600">5.5.x</td>
                <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">Component library</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-800">React</td>
                <td className="px-4 py-3 text-slate-600">19.x</td>
                <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">UI library</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-800">Next.js</td>
                <td className="px-4 py-3 text-slate-600">15.x</td>
                <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">Page Router (CSR)</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-800">TypeScript</td>
                <td className="px-4 py-3 text-slate-600">5.x</td>
                <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">
                  Type-safe JavaScript
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-800">react-icons</td>
                <td className="px-4 py-3 text-slate-600">5.x</td>
                <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">
                  MD, FA, Lucide icons
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 rounded-xl bg-amber-50 p-4">
          <h4 className="mb-2 font-semibold text-amber-800">⚠️ Important Notes</h4>
          <ul className="space-y-1 text-sm text-amber-700">
            <li>
              • Uses <strong>Next.js Page Router</strong> (not App Router)
            </li>
            <li>
              • <strong>No `&quot;use client&quot;`</strong> - All components are CSR by default
            </li>
            <li>
              • <strong>No `tailwind.config.js`</strong> - Tailwind v4 uses CSS-based config
            </li>
            <li>
              • CSS imports:{' '}
              <code className="rounded bg-amber-100 px-1">
                @import &apos;tailwindcss&apos;; @plugin &apos;daisyui&apos;;
              </code>
            </li>
          </ul>
        </div>

        <div className="mt-6">
          <CodeBlock
            title="CSS Configuration"
            language="css"
            code={`@import 'tailwindcss';
@plugin 'daisyui';

@plugin 'daisyui/theme' {
  name: 'docsplus';
  default: true;
  --color-primary: #1a73e8;
  --color-secondary: #10b981;
  /* ... more tokens */
}`}
          />
        </div>
      </section>
    </div>
  )
}
