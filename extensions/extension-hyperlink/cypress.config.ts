import { defineConfig } from 'cypress'
import { mkdirSync, renameSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'

export default defineConfig({
  e2e: {
    baseUrl: 'http://127.0.0.1:5173',
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
      // Flatten the README-gallery spec's screenshots into
      // `docs/screenshots/<name>.png`. By default Cypress nests them
      // under `<screenshotsFolder>/<spec-basename>/<name>.png`, which
      // leaks the `.cy.ts` segment into the README's raw GitHub URLs.
      // We move the file in `after:screenshot` and return the new path
      // so Cypress's own bookkeeping stays correct.
      //
      // Filter by spec basename ('popovers.cy.ts') rather than by full
      // path: Cypress 15 sets `details.specName` to just the basename,
      // not the project-relative path. Failure screenshots from
      // `cypress/e2e/**` are untouched (different spec basename) and
      // intentional `cy.screenshot()` calls outside this spec are too.
      on('after:screenshot', (details) => {
        if (details.specName !== 'popovers.cy.ts') return
        if (details.testFailure) return
        const target = resolve(config.projectRoot, 'docs', 'screenshots', basename(details.path))
        mkdirSync(dirname(target), { recursive: true })
        renameSync(details.path, target)
        return { path: target }
      })
    }
  }
})
