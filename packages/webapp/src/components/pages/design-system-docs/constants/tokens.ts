/**
 * Design System Documentation - Token Constants
 * ==============================================
 */

import type { ColorToken, SpacingToken } from '../types'

export const LIGHT_THEME_COLORS: ColorToken[] = [
  // Base colors
  {
    name: 'Base 100',
    cssVar: '--color-base-100',
    value: '#fafbfc',
    usage: 'Document canvas, soft white'
  },
  { name: 'Base 200', cssVar: '--color-base-200', value: '#f7f9fc', usage: 'Subtle surfaces' },
  { name: 'Base 300', cssVar: '--color-base-300', value: '#e5eaf1', usage: 'Borders, dividers' },
  { name: 'Base Content', cssVar: '--color-base-content', value: '#0f172a', usage: 'Primary text' },

  // Brand colors
  {
    name: 'Primary',
    cssVar: '--color-primary',
    value: '#1a73e8',
    usage: 'CTAs, links, main actions'
  },
  {
    name: 'Secondary',
    cssVar: '--color-secondary',
    value: '#0f9d7a',
    usage: 'Presence indicators, collaboration'
  },
  {
    name: 'Accent',
    cssVar: '--color-accent',
    value: '#eab308',
    usage: 'Highlights, comments, bookmarks'
  },
  {
    name: 'Neutral',
    cssVar: '--color-neutral',
    value: '#334155',
    usage: 'Toolbar icons, secondary UI'
  },

  // Semantic colors
  { name: 'Info', cssVar: '--color-info', value: '#0284c7', usage: 'Informational messages' },
  { name: 'Success', cssVar: '--color-success', value: '#16a34a', usage: 'Positive feedback' },
  {
    name: 'Warning',
    cssVar: '--color-warning',
    value: '#ea580c',
    usage: 'Cautions (orange, NOT yellow)'
  },
  { name: 'Error', cssVar: '--color-error', value: '#dc2626', usage: 'Errors, destructive actions' }
]

export const DARK_THEME_COLORS: ColorToken[] = [
  // Base colors
  { name: 'Base 100', cssVar: '--color-base-100', value: '#0b1220', usage: 'Deep blue-black' },
  {
    name: 'Base 200',
    cssVar: '--color-base-200',
    value: '#0f172a',
    usage: 'Cards/surfaces, clear elevation'
  },
  {
    name: 'Base 300',
    cssVar: '--color-base-300',
    value: '#1e293b',
    usage: 'Borders, visible but soft'
  },
  {
    name: 'Base Content',
    cssVar: '--color-base-content',
    value: '#e5e7eb',
    usage: 'Soft white for reading'
  },

  // Brand colors
  {
    name: 'Primary',
    cssVar: '--color-primary',
    value: '#6ea8ff',
    usage: 'Softer blue, vibrant but not harsh'
  },
  { name: 'Secondary', cssVar: '--color-secondary', value: '#2fbf9b', usage: 'Calm teal-green' },
  {
    name: 'Accent',
    cssVar: '--color-accent',
    value: '#e3b341',
    usage: 'Warm gold, attention-grabbing'
  },
  { name: 'Neutral', cssVar: '--color-neutral', value: '#8b9bb0', usage: 'Muted gray-blue' },

  // Semantic colors
  { name: 'Info', cssVar: '--color-info', value: '#38bdf8', usage: 'Sky blue' },
  {
    name: 'Success',
    cssVar: '--color-success',
    value: '#22c55e',
    usage: 'Green, balanced in dark'
  },
  { name: 'Warning', cssVar: '--color-warning', value: '#fb7a3a', usage: 'Orange, clear caution' },
  { name: 'Error', cssVar: '--color-error', value: '#ff6b6b', usage: 'Coral red' }
]

export const SPACING_SCALE: SpacingToken[] = [
  { name: '1', value: '0.25rem', pixels: '4px' },
  { name: '2', value: '0.5rem', pixels: '8px' },
  { name: '3', value: '0.75rem', pixels: '12px' },
  { name: '4', value: '1rem', pixels: '16px' },
  { name: '6', value: '1.5rem', pixels: '24px' },
  { name: '8', value: '2rem', pixels: '32px' },
  { name: '12', value: '3rem', pixels: '48px' },
  { name: '16', value: '4rem', pixels: '64px' }
]

export const RADIUS_SCALE = [
  { name: 'none', value: '0', usage: 'No rounding' },
  { name: 'sm', value: '0.125rem', usage: 'Subtle rounding' },
  { name: 'md', value: '0.375rem', usage: 'Default inputs' },
  { name: 'lg', value: '0.5rem', usage: 'Buttons, badges' },
  { name: 'xl', value: '0.75rem', usage: 'Cards, panels' },
  { name: '2xl', value: '1rem', usage: 'Modals, large cards' },
  { name: '3xl', value: '1.5rem', usage: 'Hero sections' },
  { name: 'full', value: '9999px', usage: 'Pills, avatars' },
  // Semantic tokens
  { name: 'selector', value: 'var(--radius-selector)', usage: 'Buttons, chips (Theme dependent)' },
  { name: 'field', value: 'var(--radius-field)', usage: 'Inputs, selects (Theme dependent)' },
  { name: 'box', value: 'var(--radius-box)', usage: 'Cards, modals (Theme dependent)' }
]

export const SHADOW_SCALE = [
  { name: 'none', class: 'shadow-none', usage: 'No shadow' },
  { name: 'sm', class: 'shadow-sm', usage: 'Subtle elevation' },
  { name: 'md', class: 'shadow-md', usage: 'Cards, buttons' },
  { name: 'lg', class: 'shadow-lg', usage: 'Dropdowns, popovers' },
  { name: 'xl', class: 'shadow-xl', usage: 'Modals' },
  { name: '2xl', class: 'shadow-2xl', usage: 'Prominent elements' }
]

export const Z_INDEX_SCALE = [
  { name: 'Base', class: 'z-0', value: '0', usage: 'Default content' },
  { name: 'Raised', class: 'z-10', value: '10', usage: 'Dropdowns closed' },
  { name: 'Dropdown', class: 'z-20', value: '20', usage: 'Open dropdowns' },
  { name: 'Sticky', class: 'z-30', value: '30', usage: 'Sticky headers' },
  { name: 'Overlay', class: 'z-40', value: '40', usage: 'Modal backdrops' },
  { name: 'Modal', class: 'z-50', value: '50', usage: 'Modal content' },
  { name: 'Popover', class: 'z-[60]', value: '60', usage: 'Popovers above modals' },
  { name: 'Toast', class: 'z-[100]', value: '100', usage: 'Notifications' }
]

export const TIMING_SCALE = [
  { name: 'Instant', class: 'duration-75', value: '75ms', usage: 'Hover color changes' },
  { name: 'Fast', class: 'duration-150', value: '150ms', usage: 'Button clicks, toggles' },
  { name: 'Normal', class: 'duration-200', value: '200ms', usage: 'Default transitions' },
  { name: 'Smooth', class: 'duration-300', value: '300ms', usage: 'Panel slides, modals' },
  { name: 'Slow', class: 'duration-500', value: '500ms', usage: 'Page transitions' }
]
