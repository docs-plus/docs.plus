/** @type {import('next').NextConfig} */

const runtimeCaching = require('next-pwa/cache')
const isProduction = process.env.NODE_ENV === 'production'
const path = require('path')
const { createSecureHeaders } = require('next-secure-headers')
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: !isProduction,
  register: true,
  skipWaiting: false,
  runtimeCaching
  // disableDevLogs: true,
})

module.exports = withPWA({
  // sassOptions: {
  //   // includePaths: [path.join(__dirname, 'styles')]
  //   scss: {
  //     api: 'moder-compiler'
  //   }
  // },
  sassOptions: {
    silenceDeprecations: ['legacy-js-api']
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // 🔥 Allow all HTTPS domains
        port: '',
        pathname: '/**'
      },
      {
        protocol: 'http',
        hostname: '*.localhost',
        port: '',
        pathname: '/**'
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '',
        pathname: '/**'
      }
    ]
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  compiler: {
    removeConsole: isProduction
  },
  async headers() {
    // 🚀 Clean, modular CSP - only what each directive needs
    // Reduces header size by 70%+ and makes maintenance easier
    // Extract domains from environment URLs (remove paths for CSP)
    const envUrls = [
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_PROVIDER_URL,
      process.env.NEXT_PUBLIC_RESTAPI_URL
    ]
      .filter(Boolean)
      .map((url) => {
        try {
          // Extract just the origin (protocol + domain) from full URLs
          const urlObj = new URL(url)
          return urlObj.origin
        } catch {
          // If it's not a valid URL, return as-is
          return url
        }
      })

    const devUrls = !isProduction
      ? [
          '*.localhost',
          '*.127.0.0.1',
          'ws://192.168.31.248:54321',
          'http://127.0.0.1:2300',
          'http://127.0.0.1:54321', // Supabase local
          'ws://127.0.0.1:54321', // Supabase realtime WebSocket
          'ws://127.0.0.1:1234' // Additional dev WebSocket
        ]
      : [] // Only in dev

    // Each directive gets exactly what it needs - no bloat
    const cspSources = {
      script: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        '*.googletagmanager.com',
        '*.google-analytics.com',
        'accounts.google.com', // Google One Tap Auth
        '*.cloudflare.com',
        ...envUrls,
        ...devUrls
      ],
      style: [
        "'self'",
        "'unsafe-inline'",
        'fonts.googleapis.com',
        'accounts.google.com',
        ...envUrls,
        ...devUrls
      ],
      connect: [
        "'self'",
        '*.supabase.co',
        'wss://*.supabase.co',
        '*.google-analytics.com',
        '*.googletagmanager.com',
        'accounts.google.com',
        '*.googleusercontent.com',
        '*.cloudflare.com',
        ...envUrls,
        ...devUrls
      ],
      font: ["'self'", 'data:', 'fonts.gstatic.com', ...envUrls],
      image: ["'self'", 'data:', 'blob:', 'https:', ...devUrls], // 🔥 All HTTPS images
      media: ["'self'", 'data:', 'blob:', 'https:', ...devUrls],
      frame: ["'self'", '*.cloudflare.com', 'accounts.google.com', ...envUrls, ...devUrls],
      form: ["'self'", ...envUrls, ...devUrls]
    }

    return [
      {
        source: '/:path*',
        headers: createSecureHeaders({
          contentSecurityPolicy: {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: cspSources.script,
              styleSrc: cspSources.style,
              imgSrc: cspSources.image,
              mediaSrc: cspSources.media,
              connectSrc: cspSources.connect,
              fontSrc: cspSources.font,
              objectSrc: ["'none'"],
              frameSrc: cspSources.frame,
              frameAncestors: ["'self'"],
              formAction: cspSources.form,
              upgradeInsecureRequests: []
            }
          },
          strictTransportSecurity: {
            maxAge: 63072000,
            includeSubDomains: true,
            preload: true
          },
          xContentTypeOptions: 'nosniff',
          referrerPolicy: 'same-origin',
          xFrameOptions: 'DENY',
          xXSSProtection: '1; mode=block'
        })
      },
      {
        source: '/robots.txt',
        headers: [
          {
            key: 'Content-Type',
            value: 'text/plain'
          }
        ]
      }
    ]
  }
})
