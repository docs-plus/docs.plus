import { defineConfig, splitVendorChunkPlugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import manifest from './src/manifest.json'


// import { registerSW } from 'virtual:pwa-register'

// const updateSW = registerSW({
//   onNeedRefresh() {
//     console.log("onNeedRefresh=??")
//   },
//   onOfflineReady() {
//     console.log("onOfflineReady=??")
//   }
// })


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    splitVendorChunkPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        sourcemap: true,
        cleanupOutdatedCaches: true,
      },
      manifest,
      devOptions: {
        enabled: true
      }
    })
  ],
})
