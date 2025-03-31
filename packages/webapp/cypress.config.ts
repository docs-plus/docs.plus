import { defineConfig } from 'cypress'

export default defineConfig({
  projectId: '5vy66e',

  e2e: {
    setupNodeEvents(on, config) {
      // We'll add the clipboard tasks back after basic config works
      return config
    }
  }
})
