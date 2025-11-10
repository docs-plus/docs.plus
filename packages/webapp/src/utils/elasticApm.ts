import { init as initApm } from '@elastic/apm-rum'

export const initializeApm = () => {
  if (typeof window === 'undefined') {
    return // Prevent initialization during SSR
  }
  if (!process.env.NEXT_PUBLIC_ELASTIC_APM_SERVER_URL) return

  initApm({
    serviceName: process.env.NEXT_PUBLIC_ELASTIC_APM_SERVICE_NAME || 'webapp_rum',
    serverUrl: process.env.NEXT_PUBLIC_ELASTIC_APM_SERVER_URL || '',
    environment: process.env.NODE_ENV || 'development',
    active: process.env.NODE_ENV === 'production', // Only enable APM in production
    logLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug', // Use debug logs in development
    pageLoadTransactionName: window.location.pathname // Use pathname as transaction name
  })
}
