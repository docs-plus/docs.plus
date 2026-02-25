import { defineConfig } from 'cypress'
import codeCoverageTask from '@cypress/code-coverage/task'

export default defineConfig({
  projectId: '5vy66e',
  allowCypressEnv: false,

  e2e: {
    excludeSpecPattern: ['**/manual-browser-test/**'],
    setupNodeEvents(on, config) {
      const isCoverageEnabled =
        Boolean(config.env.coverageEnabled) ||
        process.env.CYPRESS_COVERAGE === 'true' ||
        process.env.COVERAGE === 'true'

      if (isCoverageEnabled) {
        config = codeCoverageTask(on, config)
      }

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
