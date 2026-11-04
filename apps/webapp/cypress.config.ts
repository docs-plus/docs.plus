import { execFileSync } from 'node:child_process'

import { defineConfig } from 'cypress'
import codeCoverageTask from '@cypress/code-coverage/task'
import cypressSplit from 'cypress-split'
import * as Y from 'yjs'

// Full-stack DB assertions for the e2e/document specs. Targets the Prisma pg
// (docsy-postgres-local:5432/docsplus) — NOT Supabase (:54322) — via `docker
// exec` so no `pg` dependency is added.
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
const queryDocBySlug = (slug: string): { documentId: string; ownerId: string | null } | null => {
  const out = psql(
    ['-v', `slug=${slug}`],
    `select "documentId", "ownerId" from "DocumentMetadata" where slug = :'slug' limit 1`
  )
  if (!out) return null
  // psql -A prints SQL NULL as an empty field.
  const [documentId, ownerId] = out.split('|')
  return { documentId, ownerId: ownerId || null }
}
const documentDbTasks = {
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
  // Reads the stored head row directly, so no service-role key is needed.
  // Postgres wraps base64 every 76 chars; strip that before decoding.
  queryDocHeadText(documentId: string): string | null {
    const b64 = psql(
      ['-v', `docid=${documentId}`],
      `select encode(data,'base64') from "Documents" where "documentId" = :'docid' order by version desc limit 1`
    )
    if (!b64) return null
    const doc = new Y.Doc()
    Y.applyUpdate(doc, Buffer.from(b64.replace(/\s+/g, ''), 'base64'))
    return doc.getXmlFragment('default').toString()
  },
  async waitForDocBySlug(slug: string): Promise<ReturnType<typeof queryDocBySlug>> {
    for (let i = 0; i < 40; i++) {
      const row = queryDocBySlug(slug)
      if (row) return row
      await new Promise((r) => setTimeout(r, 500))
    }
    return null
  },
  // A metadata row with no content: enough for the hovercard route, which reads only this row.
  insertPadMeta(meta: { slug: string; title: string; isPrivate: boolean; ownerId: string | null }) {
    psql(
      [
        '-v',
        `slug=${meta.slug}`,
        '-v',
        `title=${meta.title}`,
        '-v',
        `private=${meta.isPrivate}`,
        '-v',
        `owner=${meta.ownerId ?? ''}`
      ],
      `insert into "DocumentMetadata" (slug, title, "documentId", "isPrivate", "ownerId", "updatedAt") values (:'slug', :'title', :'slug', :'private'::boolean, nullif(:'owner', ''), now())`
    )
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
  video: false,
  screenshotOnRunFailure: true,
  numTestsKeptInMemory: 0,

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
        ...documentDbTasks
      })
      return config
    }
  }
})
