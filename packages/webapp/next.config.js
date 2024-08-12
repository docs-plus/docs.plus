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
  sassOptions: {
    includePaths: [path.join(__dirname, 'styles')]
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
      '*.googleusercontent.com',
      '*.supabase.co',
      '*.docs.plus',
      '*.localhost',
      process.env.NEXT_PUBLIC_RESTAPI_URL,
      process.env.NEXT_PUBLIC_PROVIDER_URL,
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_WS_URL
    ]

    return [
      {
        source: '/:path*',
        headers: createSecureHeaders({
          contentSecurityPolicy: {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: allowAddress,
              connectSrc: allowAddress,
              fontSrc: ["'self'", 'data:'],
              objectSrc: ["'none'"],
              frameSrc: ["'self'"],
              frameAncestors: ["'self'"],
              formAction: ["'self'"],
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
