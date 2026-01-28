/**
 * Design System Documentation - Navigation Constants
 * ===================================================
 */

import type { NavSection } from '../types'

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    items: [
      { id: 'introduction', label: 'Introduction' },
      { id: 'how-to-use', label: 'How to Use' },
      { id: 'tech-stack', label: 'Tech Stack' }
    ]
  },
  {
    id: 'foundations',
    title: 'Foundations',
    items: [
      { id: 'colors', label: 'Colors' },
      { id: 'typography', label: 'Typography' },
      { id: 'spacing', label: 'Spacing & Layout' },
      { id: 'radius-shadow', label: 'Radius & Shadow' },
      { id: 'motion', label: 'Motion' },
      { id: 'z-index', label: 'Z-Index Scale' }
    ]
  },
  {
    id: 'components',
    title: 'Components',
    items: [
      { id: 'buttons', label: 'Button' },
      { id: 'inputs', label: 'TextInput' },
      { id: 'select', label: 'Select' },
      { id: 'textarea', label: 'Textarea' },
      { id: 'file-input', label: 'FileInput' },
      { id: 'checkbox', label: 'Checkbox' },
      { id: 'toggle', label: 'Toggle' },
      { id: 'badges-alerts', label: 'Badges & Alerts' },
      { id: 'cards', label: 'Cards' },
      { id: 'modals', label: 'Modals & Dialogs' },
      { id: 'tooltips-dropdowns', label: 'Tooltips & Dropdowns' },
      { id: 'avatar', label: 'Avatar & Presence' },
      { id: 'loading', label: 'Loading States' },
      { id: 'toasts', label: 'Toast Notifications' },
      { id: 'copy-button', label: 'CopyButton' }
    ]
  },
  {
    id: 'editor-components',
    title: 'Editor UI',
    items: [
      { id: 'toolbar', label: 'Editor Toolbar' },
      { id: 'formatting', label: 'Formatting Controls' },
      { id: 'comments', label: 'Comments & Mentions' },
      { id: 'doc-title', label: 'Document Title' },
      { id: 'presence-avatars', label: 'Presence Avatars' },
      { id: 'share-modal', label: 'Share Modal' },
      { id: 'version-history', label: 'Version History' }
    ]
  },
  {
    id: 'patterns',
    title: 'Patterns',
    items: [
      { id: 'layout-patterns', label: 'Layout Patterns' },
      { id: 'empty-states', label: 'Empty States' },
      { id: 'loading-patterns', label: 'Loading Patterns' },
      { id: 'error-states', label: 'Error States' },
      { id: 'confirmation-dialogs', label: 'Confirmation Dialogs' },
      { id: 'collaboration', label: 'Collaboration Patterns' },
      { id: 'form-validation', label: 'Form Validation' }
    ]
  },
  {
    id: 'accessibility',
    title: 'Accessibility',
    items: [
      { id: 'a11y-checklist', label: 'Checklist' },
      { id: 'keyboard-nav', label: 'Keyboard Navigation' },
      { id: 'focus-management', label: 'Focus Management' }
    ]
  },
  {
    id: 'implementation',
    title: 'Implementation',
    items: [
      { id: 'file-structure', label: 'File Structure' },
      { id: 'naming-conventions', label: 'Naming Conventions' },
      { id: 'contributing', label: 'Contributing' }
    ]
  }
]
