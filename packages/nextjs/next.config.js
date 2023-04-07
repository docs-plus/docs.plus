/** @type {import('next').NextConfig} */

const runtimeCaching = require('next-pwa/cache')
const isProduction = process.env.NODE_ENV === 'production';

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: false,
  runtimeCaching,
  // disable: process.env.NODE_ENV === 'development',
  disableDevLogs: true,

})


module.exports = withPWA({
  // config

  eslint: {
    ignoreDuringBuilds: true,
  },
})
