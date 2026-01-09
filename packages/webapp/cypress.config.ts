import { defineConfig } from 'cypress'

export default defineConfig({
  projectId: '5vy66e',

  e2e: {
    setupNodeEvents(on, config) {
      on('task', {
        log(message) {
          console.log(message)
          return null
        }
      })
      return config
    }
  }
})
