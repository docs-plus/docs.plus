/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,

  // Disable static generation for error pages (workaround for Next.js 16 Turbopack issue)
  // This forces all pages to be SSR, avoiding the "NextRouter was not mounted" error
  experimental: {
    // PPR (Partial Pre-Rendering) disabled
    ppr: false
  },

  // Sass deprecation warnings
  sassOptions: {
    silenceDeprecations: ['legacy-js-api', 'import']
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co'
      }
    ]
  },

  // Turbopack workspace root (silence monorepo warning)
  turbopack: {
    root: '../../'
  },

  // Security headers (OWASP compliant)
  async headers() {
    const isDev = process.env.NODE_ENV === 'development'

    // Content Security Policy
    // - 'self' for same-origin resources
    // - 'unsafe-inline' for Next.js inline scripts/styles
    // - 'unsafe-eval' only in development (for React Fast Refresh)
    // - Supabase domains for API and WebSocket connections
    // - Google domains for OAuth
    // - localhost/127.0.0.1 for local Supabase in development
    const localDevHosts = isDev
      ? ' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*'
      : ''

    const cspDirectives = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: https://*.supabase.co https://*.googleusercontent.com${isDev ? ' http://localhost:* http://127.0.0.1:*' : ''}`,
      "font-src 'self' data:",
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com${localDevHosts}`,
      `frame-src 'self' https://accounts.google.com${isDev ? ' http://localhost:*' : ''}`,
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'"
    ]

    return [
      {
        source: '/:path*',
        headers: [
          // Prevent clickjacking
          { key: 'X-Frame-Options', value: 'DENY' },
          // Prevent MIME type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Control referrer information
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Force HTTPS (only in production - 1 year max-age)
          ...(isDev
            ? []
            : [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=31536000; includeSubDomains; preload'
                }
              ]),
          // Content Security Policy
          { key: 'Content-Security-Policy', value: cspDirectives.join('; ') },
          // Restrict browser features
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          },
          // Prevent XSS attacks (legacy browsers)
          { key: 'X-XSS-Protection', value: '1; mode=block' }
        ]
      }
    ]
  }
}

module.exports = nextConfig
