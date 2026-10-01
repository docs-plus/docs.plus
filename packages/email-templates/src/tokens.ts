/** Email clients ignore CSS variables — every value here is hardcoded hex. */

export const APP_NAME = 'docs.plus'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://docs.plus'

export const COLORS = {
  primary: '#1a73e8', // --color-primary (docs blue)

  text: '#1f2937', // close to base-content (#0f172a)
  textMuted: '#69707e', // gray-500 one step darker: 4.5:1 on borderLight (code chips)
  // Footer and meta lines: at least 4.5:1 on every ground, down to padWell.
  textMeta: '#636a76',

  border: '#e5e7eb', // close to base-300 (#dce3ed)
  borderLight: '#f3f4f6', // gray-100

  background: '#f9fafb', // footer and card ground, close to base-100 (#ffffff)
  outerBg: '#f5f5f5', // email body bg
  padWell: '#eef1f6', // base-200, the pad workspace well
  sheetBorder: '#dce3ed', // base-300, the document sheet edge

  white: '#ffffff',

  // History compare uses a light wash. Mail cannot mix colours, so these are the washes.
  addedWash: '#d1fae5',
  removedWash: '#fee2e2',
  // Close to History's base-content/70 on the wash; 6.2:1 on removedWash.
  removedInk: '#4b5563'
} as const

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px'
} as const

export const RADIUS = {
  md: '8px', // --radius-field
  lg: '10px' // --radius-box
} as const

// The app type stack (--font-sans); already email-safe. No double quotes:
// base.eta writes it raw into a style attribute.
export const FONT_STACK = 'Helvetica, Arial, sans-serif'
