/** @type {import('next').NextConfig} */

// HINT: if you want to disable the workbox logs in your console,
// just open console logs and put this `-/workbox/` in the filter bar.

const runtimeCaching = require('next-pwa/cache')
const isProduction = process.env.NODE_ENV === 'production'
const path = require('path')

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: isProduction,
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
  }
})
