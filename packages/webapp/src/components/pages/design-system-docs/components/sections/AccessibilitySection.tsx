/**
 * Accessibility Section
 * =====================
 * Accessibility checklist, keyboard navigation, and focus management.
 */

import { MdAccessibility, MdKeyboard, MdCenterFocusStrong } from 'react-icons/md'
import { SectionHeader } from '../shared'

const A11Y_CHECKLIST = [
  {
    category: 'Keyboard Navigation',
    items: [
      { label: 'All interactive elements are focusable', checked: true },
      { label: 'Tab order follows logical reading order', checked: true },
      { label: 'Dialogs trap focus while open', checked: true },
      { label: 'ESC key closes modals/popovers', checked: true },
      { label: 'Arrow keys navigate menus and tabs', checked: false },
      { label: 'Enter/Space activates buttons and links', checked: true }
    ]
  },
  {
    category: 'Focus Indicators',
    items: [
      { label: 'Visible focus ring on all interactive elements', checked: true },
      { label: 'Focus ring uses primary color', checked: true },
      { label: 'Focus ring has sufficient contrast (3:1)', checked: true },
      { label: 'No focus ring on mouse click (optional)', checked: false }
    ]
  },
  {
    category: 'Color & Contrast',
    items: [
      { label: 'Text contrast ratio of 4.5:1 minimum', checked: true },
      { label: 'Large text contrast ratio of 3:1 minimum', checked: true },
      { label: 'Color is not the only means of conveying info', checked: true },
      { label: 'Focus indicator has 3:1 contrast', checked: true }
    ]
  },
  {
    category: 'Touch Targets',
    items: [
      { label: 'Touch targets are at least 44x44px', checked: true },
      { label: 'Adequate spacing between targets', checked: true },
      { label: 'Targets easy to tap on mobile', checked: true }
    ]
  },
  {
    category: 'ARIA & Semantics',
    items: [
      { label: 'Dialogs have role="dialog" and aria-modal', checked: true },
      { label: 'Buttons use <button> element', checked: true },
      { label: 'Links use <a> element for navigation', checked: true },
      { label: 'Headings follow proper hierarchy', checked: true },
      { label: 'Tooltips use aria-describedby', checked: false },
      { label: 'Loading states use aria-busy', checked: false }
    ]
  }
]

export const AccessibilitySection = () => {
  return (
    <div className="space-y-16">
      {/* Checklist */}
      <section id="a11y-checklist">
        <SectionHeader
          id="a11y-checklist-header"
          title="Accessibility Checklist"
          description="Quick reference for accessible component development"
          icon={MdAccessibility}
        />

        <div className="space-y-6">
          {A11Y_CHECKLIST.map((section) => (
            <div
              key={section.category}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h3 className="font-semibold text-slate-700">{section.category}</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {section.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm checkbox-primary"
                      checked={item.checked}
                      readOnly
                    />
                    <span
                      className={`text-sm ${item.checked ? 'text-slate-700' : 'text-slate-500'}`}>
                      {item.label}
                    </span>
                    {!item.checked && (
                      <span className="ml-auto rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Needs work
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Keyboard Navigation */}
      <section id="keyboard-nav">
        <SectionHeader
          id="keyboard-nav-header"
          title="Keyboard Navigation"
          description="Expected keyboard behavior for components"
          icon={MdKeyboard}
        />

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-700">Component</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Key</th>
                <th className="hidden px-4 py-3 font-semibold text-slate-700 sm:table-cell">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              <tr>
                <td className="px-4 py-3 font-medium text-slate-800">All</td>
                <td className="px-4 py-3">
                  <kbd className="kbd kbd-sm">Tab</kbd>
                </td>
                <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">
                  Move to next focusable element
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-800">All</td>
                <td className="px-4 py-3">
                  <kbd className="kbd kbd-sm">Shift</kbd> + <kbd className="kbd kbd-sm">Tab</kbd>
                </td>
                <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">
                  Move to previous focusable element
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-800">Modal</td>
                <td className="px-4 py-3">
                  <kbd className="kbd kbd-sm">Esc</kbd>
                </td>
                <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">Close the modal</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-800">Dropdown</td>
                <td className="px-4 py-3">
                  <kbd className="kbd kbd-sm">Enter</kbd> / <kbd className="kbd kbd-sm">Space</kbd>
                </td>
                <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">
                  Open dropdown / select item
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-800">Dropdown</td>
                <td className="px-4 py-3">
                  <kbd className="kbd kbd-sm">↑</kbd> / <kbd className="kbd kbd-sm">↓</kbd>
                </td>
                <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">Navigate items</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-800">Tabs</td>
                <td className="px-4 py-3">
                  <kbd className="kbd kbd-sm">←</kbd> / <kbd className="kbd kbd-sm">→</kbd>
                </td>
                <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">
                  Switch between tabs
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-800">Button</td>
                <td className="px-4 py-3">
                  <kbd className="kbd kbd-sm">Enter</kbd> / <kbd className="kbd kbd-sm">Space</kbd>
                </td>
                <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">
                  Activate the button
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Focus Management */}
      <section id="focus-management">
        <SectionHeader
          id="focus-management-header"
          title="Focus Management"
          description="Focus ring styles and focus trap patterns"
          icon={MdCenterFocusStrong}
        />

        <div className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
              <span className="text-sm font-semibold text-slate-700">Focus Ring Preview</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 p-6">
              <button className="btn btn-primary focus:outline-primary focus:outline focus:outline-2 focus:outline-offset-2">
                Primary Button
              </button>
              <button className="btn btn-ghost focus:outline-primary focus:outline focus:outline-2 focus:outline-offset-2">
                Ghost Button
              </button>
              <input
                type="text"
                placeholder="Focus me"
                className="input input-bordered focus:border-primary focus:outline-primary focus:outline focus:outline-2"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="mb-2 font-semibold text-slate-800">Focus Ring Classes</h4>
              <code className="block rounded bg-slate-100 p-2 text-xs text-slate-700">
                focus:outline focus:outline-2 focus:outline-primary
              </code>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="mb-2 font-semibold text-slate-800">Input Focus Classes</h4>
              <code className="block rounded bg-slate-100 p-2 text-xs text-slate-700">
                focus:border-primary focus:ring-2 focus:ring-primary/20
              </code>
            </div>
          </div>

          <div className="rounded-xl bg-blue-50 p-4">
            <h4 className="mb-2 font-semibold text-blue-800">💡 Focus Trap Pattern</h4>
            <p className="mb-2 text-sm text-blue-700">
              Modals should trap focus within their content. Use Floating UI or a focus trap
              library:
            </p>
            <code className="block rounded bg-blue-100 p-2 text-xs text-blue-800">
              {`<FloatingFocusManager context={context} modal={true}>
  <div className="modal-content">...</div>
</FloatingFocusManager>`}
            </code>
          </div>
        </div>
      </section>
    </div>
  )
}
