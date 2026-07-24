import { execFileSync } from 'node:child_process'

import { defineConfig } from 'cypress'
import codeCoverageTask from '@cypress/code-coverage/task'
import cypressSplit from 'cypress-split'

// Full-stack draft-anchor E2E DB assertions. Targets the Prisma pg
// (docsy-postgres-local:5432/docsplus) — NOT Supabase (:54322) — via `docker
// exec` so no `pg` dependency is added. Only used by draft-first-edit-anchor.cy.ts.
// execFileSync (no shell) + psql `-v` variables (`:'slug'` is server-side quoted)
// keep both the shell and SQL layers injection-safe.
const psql = (vars: string[], sql: string): string => {
  try {
    // SQL rides stdin (where psql runs `:'var'` interpolation); values come via
    // -v so they are server-side quoted. execFileSync => no shell.
    return execFileSync(
      'docker',
      [
        'exec',
        '-i',
        'docsy-postgres-local',
        'psql',
        '-U',
        'docsplus',
        '-d',
        'docsplus',
        '-At',
        '-F',
        '|',
        ...vars
      ],
      { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    ).trim()
  } catch {
    return ''
  }
}
const queryDocBySlug = (slug: string): { documentId: string } | null => {
  const out = psql(
    ['-v', `slug=${slug}`],
    `select "documentId" from "DocumentMetadata" where slug = :'slug' limit 1`
  )
  return out ? { documentId: out.split('|')[0] } : null
}
const draftAnchorTasks = {
  queryDocBySlug,
  queryDocVersionCount(documentId: string): number {
    return (
      Number(
        psql(
          ['-v', `docid=${documentId}`],
          `select count(*) from "Documents" where "documentId" = :'docid'`
        )
      ) || 0
    )
  },
  async waitForDocBySlug(slug: string): Promise<{ documentId: string } | null> {
    for (let i = 0; i < 40; i++) {
      const row = queryDocBySlug(slug)
      if (row) return row
      await new Promise((r) => setTimeout(r, 500))
    }
    return null
  },
  deleteDocBySlug(slug: string): null {
    psql(
      ['-v', `slug=${slug}`],
      `delete from "Documents" where "documentId" in (select "documentId" from "DocumentMetadata" where slug = :'slug'); delete from "DocumentMetadata" where slug = :'slug'`
    )
    return null
  }
}

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
        },
        ...draftAnchorTasks
      })
      return config
    }
  }
})
