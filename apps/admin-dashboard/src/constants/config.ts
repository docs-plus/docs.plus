/**
 * Centralized configuration constants
 */

// App URL for opening documents in main app (webapp dev server defaults to :3000)
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// API URL for backend requests
// API_URL is the base URL - endpoints include /api/admin/... paths
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
