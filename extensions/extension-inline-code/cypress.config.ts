import { flattenReadmeScreenshots } from '@docs.plus/playground/cypress/flattenReadmeScreenshots'
import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://127.0.0.1:5176',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    fixturesFolder: false,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 6000,
    viewportWidth: 1280,
    viewportHeight: 800,
    retries: { runMode: 1, openMode: 0 },
    setupNodeEvents(on, config) {
      flattenReadmeScreenshots(on, config, 'readme-gallery.cy.ts')
    }
  }
})
