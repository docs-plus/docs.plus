import { mkdirSync, renameSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import type { PluginConfigOptions, PluginEvents } from 'cypress/types/cypress'

/** Flatten README-gallery `cy.screenshot()` output into tracked `assets/`. */
export function flattenReadmeScreenshots(
  on: PluginEvents,
  config: PluginConfigOptions,
  specBasename: string
): void {
  on('after:screenshot', (details) => {
    const spec = details.specName
    const matches =
      spec != null && (spec === specBasename || basename(spec) === specBasename)
    if (!matches || details.testFailure) return

    const target = resolve(config.projectRoot, 'assets', basename(details.path))
    mkdirSync(dirname(target), { recursive: true })
    renameSync(details.path, target)
    return { path: target }
  })
}
