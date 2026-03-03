import { defineConfig } from 'cypress'
import codeCoverageTask from '@cypress/code-coverage/task'
import cypressSplit from 'cypress-split'

export default defineConfig({
  projectId: '5vy66e',
  allowCypressEnv: false,
  video: false,
  screenshotOnRunFailure: true,
  numTestsKeptInMemory: 0,
  experimentalMemoryManagement: true,

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

      cypressSplit(on, config)

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
