/**
 * Email Design Tokens
 *
 * Aligned with the docs.plus design system (Design_System_Global_v2.md §3.1).
 * These tokens are shared across ALL email templates — both notification
 * emails (templates.ts) and Supabase auth emails (magic-link, change-email).
 *
 * ⚠️  Email clients ignore CSS variables. All values must be hardcoded hex.
 */

export const APP_NAME = 'docs.plus'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://docs.plus'

// ---------------------------------------------------------------------------
// Colors (from DaisyUI docsplus theme → hex equivalents)
// ---------------------------------------------------------------------------

export const COLORS = {
  primary: '#1a73e8', // --color-primary (docs blue)
  primaryLight: '#e8f0fe', // light blue bg (cards, highlights)
  secondary: '#0f9d7a', // --color-secondary (teal-green)

  text: '#1f2937', // gray-800  (--bc / base-content)
  textMuted: '#6b7280', // gray-500
  textLight: '#9ca3af', // gray-400

  border: '#e5e7eb', // gray-200  (--b3 / base-300)
  borderLight: '#f3f4f6', // gray-100

  background: '#f9fafb', // gray-50   (--b1 / base-100 area bg)
  outerBg: '#f5f5f5', // email body bg

  white: '#ffffff',

  // Status (only used in unsubscribe page)
  success: '#10b981', // emerald-500
  error: '#ef4444' // red-500
} as const

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px'
} as const

// ---------------------------------------------------------------------------
// Border radius
// ---------------------------------------------------------------------------

export const RADIUS = {
  sm: '6px',
  md: '8px', // --radius-field
  lg: '10px', // --radius-box small
  xl: '12px' // card radius
} as const

// ---------------------------------------------------------------------------
// Typography — system font stack (email-safe)
// ---------------------------------------------------------------------------

export const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
