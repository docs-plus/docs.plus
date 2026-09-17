import { expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const runner = readFileSync(new URL('./run-tests.sh', import.meta.url), 'utf8')
// Load the actual parser without starting the browser suites.
const parser = runner.match(/^parse_cypress_results\(\) \{[\s\S]*?^\}/m)?.[0]
if (!parser) throw new Error('The Cypress result parser was not found')

function parse(log: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'cypress-results-'))
  try {
    const file = join(directory, 'worker.log')
    writeFileSync(file, log)
    const result = spawnSync('bash', ['-c', `${parser}\nparse_cypress_results "$1"`, '--', file], {
      encoding: 'utf8'
    })
    if (result.error) throw result.error
    expect(result.status).toBe(0)
    return result.stdout.trim()
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test('counts colored Cypress rows without counting the summary twice', () => {
  const log = [
    '\u001b[0m  (\u001b[4m\u001b[1mRun Finished\u001b[22m\u001b[24m)\u001b[0m',
    '\u001b[90m │\u001b[39m \u001b[32m✔\u001b[39m \u001b[0mattachments.cy.ts\u001b[0m \u001b[90m00:09\u001b[39m \u001b[0m20\u001b[0m \u001b[32m19\u001b[39m \u001b[90m-\u001b[39m \u001b[36m1\u001b[39m \u001b[90m-\u001b[39m │',
    '\u001b[32m✔ All specs passed!\u001b[39m 00:09 20 19 - 1 -'
  ].join('\n')
  expect(parse(log)).toBe('✔|attachments.cy.ts|00:09|20|19|-|1|-')
})

test('retains failures and skipped counts in uncolored Cypress rows', () => {
  const log = [
    '  (Run Finished)',
    '  │ ✖ send-and-retry.cy.ts 00:04 4 1 2 - 1 │',
    '  ✖ 1 of 1 failed (100%) 00:04 4 1 2 - 1'
  ].join('\n')
  expect(parse(log)).toBe('✖|send-and-retry.cy.ts|00:04|4|1|2|-|1')
})
