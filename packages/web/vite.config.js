import { defineConfig, splitVendorChunkPlugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

import manifest from './src/manifest.json'


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    splitVendorChunkPlugin(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      workbox: {
        sourcemap: true,
        cleanupOutdatedCaches: true
      },
      manifest,
      devOptions: {
        enabled: false
      }
    })
  ]
})
