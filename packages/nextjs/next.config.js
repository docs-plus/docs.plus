/** @type {import('next').NextConfig} */

const runtimeCaching = require('next-pwa/cache')
const isProduction = process.env.NODE_ENV === 'production'

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: false,
  runtimeCaching
  // disable: process.env.NODE_ENV === 'development',
  // disableDevLogs: true,
})

module.exports = withPWA({
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
