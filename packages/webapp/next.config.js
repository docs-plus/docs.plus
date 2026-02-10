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
  runtimeCaching,
  // Exclude files that don't exist in Next.js 15+
  buildExcludes: [/dynamic-css-manifest\.json$/, /middleware-manifest\.json$/],
  // Import custom service worker for push notifications
  importScripts: ['/service-worker.js']
})

module.exports = withPWA({
  // Production build optimization - standalone output for Docker
  output: 'standalone',

  // Fix for monorepo with multiple lockfiles
  outputFileTracingRoot: path.join(__dirname, '../../'),

  // Dev mode optimizations (faster compilation, especially in Docker)
  ...(process.env.NODE_ENV === 'development' && {
    // Skip type checking during dev (Next.js handles it separately)
    typescript: {
      ignoreBuildErrors: false // Still check, but don't block compilation
    },
    // Faster refresh
    reactStrictMode: true,
    // Reduce logging in dev
    logging: {
      fetches: {
        fullUrl: false
      }
    },
    // Optimize for Docker/macOS volume performance
    // Disable source maps in dev for faster compilation (can re-enable if needed for debugging)
    productionBrowserSourceMaps: false
  }),

  // Performance optimizations
  poweredByHeader: false,
  generateEtags: true,
  compress: true,

  // Build optimizations (swcMinify is now default in Next.js 15)
  modularizeImports: {
    '@mui/icons-material': {
      transform: '@mui/icons-material/{{member}}'
    },
    'react-icons': {
      transform: 'react-icons/{{member}}'
    }
  },

  // Experimental features for performance
  experimental: {
    optimizePackageImports: [
      '@emoji-mart/react',
      '@tiptap/react',
      'react-icons',
      '@supabase/supabase-js',
      '@supabase/ssr'
    ]
  },

  // Turbopack configuration (moved from experimental.turbo in Next.js 15)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js'
      }
    }
  },

  // Server external packages (moved from experimental in Next.js 15)
  serverExternalPackages: ['@tiptap/pm'],

  sassOptions: {
    silenceDeprecations: ['legacy-js-api', 'import']
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
    removeConsole: false,
    // removeConsole: isProduction
    //   ? {
    //       exclude: ['error', 'warn']
    //     }
    //   : false,
    // Enable React optimizations
    reactRemoveProperties: isProduction
  },

  // Production logging and monitoring
  logging: {
    fetches: {
      fullUrl: !isProduction
    }
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

    // Always include localhost for Docker deployments
    const localUrls = [
      'localhost:*',
      'http://localhost:*',
      'ws://localhost:*',
      'wss://localhost:*',
      '127.0.0.1:*',
      'http://127.0.0.1:*',
      'ws://127.0.0.1:*',
      'host.docker.internal:*',
      'http://host.docker.internal:*',
      'ws://host.docker.internal:*',
      'wss://host.docker.internal:*'
    ]

    const devUrls = !isProduction
      ? [
          '*.localhost',
          '*.127.0.0.1',
          'http://127.0.0.1:54321', // Supabase local
          'ws://127.0.0.1:54321', // Supabase realtime WebSocket
          'ws://0.0.0.0:4001', // Hocuspocus WebSocket
          'ws://127.0.0.1:4001' // Hocuspocus WebSocket alternative
        ]
      : []

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
        ...localUrls,
        ...envUrls,
        ...devUrls
      ],
      style: [
        "'self'",
        "'unsafe-inline'",
        'fonts.googleapis.com',
        'accounts.google.com',
        ...localUrls,
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
        'api.github.com',
        '*.githubusercontent.com',
        ...localUrls,
        ...envUrls,
        ...devUrls
      ],
      font: ["'self'", 'data:', 'fonts.gstatic.com', ...localUrls, ...envUrls],
      image: ["'self'", 'data:', 'blob:', 'https:', ...localUrls, ...devUrls], // 🔥 All HTTPS images
      media: ["'self'", 'data:', 'blob:', 'https:', ...localUrls, ...devUrls],
      frame: [
        "'self'",
        '*.cloudflare.com',
        'accounts.google.com',
        ...localUrls,
        ...envUrls,
        ...devUrls
      ],
      form: ["'self'", ...localUrls, ...envUrls, ...devUrls]
    }

    return [
      // ── Service Worker: MUST revalidate on every navigation ──
      // Per Google PWA best practices: browsers check for sw.js updates
      // on every navigation, but HTTP cache can prevent the fetch.
      // no-cache ensures the browser always revalidates with the server.
      // https://web.dev/articles/service-worker-lifecycle#updates
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' }
        ]
      },
      {
        source: '/workbox-:hash.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' }
        ]
      },
      {
        source: '/service-worker.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' }
        ]
      },
      {
        source: '/manifest.json',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }]
      },
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
