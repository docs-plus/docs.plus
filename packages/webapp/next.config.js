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
        hostname: '*.googleusercontent.com',
        port: '',
        pathname: '/**'
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/**'
      },
      {
        protocol: 'http',
        hostname: '*.localhost',
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
    const allowAddress = [
      "'self'",
      'data:',
      'blob:',
      '*.googleusercontent.com',
      '*.supabase.co',
      '*.docs.plus',
      '*.localhost',
      '*.127.0.0.1',
      '*.googletagmanager.com',
      '*.google.com',
      '*.google-analytics.com',
      '*.cloudflare.com',
      'wss://*.supabase.co',
      'http://127.0.0.1:2300',
      process.env.NEXT_PUBLIC_RESTAPI_URL || '',
      process.env.NEXT_PUBLIC_PROVIDER_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_WS_URL || ''
    ].filter(Boolean)

    return [
      {
        source: '/:path*',
        headers: createSecureHeaders({
          contentSecurityPolicy: {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", ...allowAddress],
              styleSrc: ["'self'", "'unsafe-inline'", ...allowAddress],
              imgSrc: ["'self'", 'blob:', ...allowAddress],
              connectSrc: [...allowAddress],
              fontSrc: ["'self'", 'data:', ...allowAddress],
              objectSrc: ["'none'"],
              frameSrc: ["'self'", ...allowAddress],
              frameAncestors: ["'self'"],
              formAction: ["'self'", ...allowAddress],
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
