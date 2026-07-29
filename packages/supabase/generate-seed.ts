#!/usr/bin/env bun
/** Concatenates the numbered SQL files under scripts/ into seed.sql, in prefix order. */

import { readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const rootDir = import.meta.dir
const scriptsDir = join(rootDir, 'scripts')
const seedFile = join(rootDir, 'seed.sql')

// 00-bootstrap.sql is listed separately in config.toml's [db.seed].sql_paths
// so CREATE EXTENSION statements commit before the main seed parses.
const excludePatterns = [
  /^test_/i,
  /^dummy_/i,
  /^idea\.sql$/i,
  /^30-seed-car-conversation\.sql$/i,
  /^00-bootstrap\.sql$/i
]

const isNumberedScript = (filename: string): boolean => {
  return /^\d+/.test(filename) && filename.endsWith('.sql')
}

// Numeric-prefix order, with one non-obvious rule: a sub-numbered file sorts before
// its non-sub-numbered sibling — 10-0, 10-0-1 and 10-1 all precede 10-functions.
const sortScripts = (a: string, b: string): number => {
  const getNumericPrefix = (
    name: string
  ): { major: number; sub1: number; sub2: number; hasSubNumbers: boolean } => {
    const match = name.match(/^(\d+)(?:-(\d+))?(?:-(\d+))?/)
    if (!match) return { major: 0, sub1: 0, sub2: 0, hasSubNumbers: false }

    const hasSubNumbers = !!(match[2] || match[3])

    return {
      major: parseInt(match[1] || '0', 10),
      sub1: parseInt(match[2] || '0', 10),
      sub2: parseInt(match[3] || '0', 10),
      hasSubNumbers
    }
  }

  const dataA = getNumericPrefix(a)
  const dataB = getNumericPrefix(b)

  if (dataA.major !== dataB.major) {
    return dataA.major - dataB.major
  }

  if (dataA.hasSubNumbers !== dataB.hasSubNumbers) {
    return dataA.hasSubNumbers ? -1 : 1
  }

  if (dataA.sub1 !== dataB.sub1) {
    return dataA.sub1 - dataB.sub1
  }
  if (dataA.sub2 !== dataB.sub2) {
    return dataA.sub2 - dataB.sub2
  }

  return a.localeCompare(b)
}

async function generateSeed() {
  try {
    console.log('📦 Reading scripts directory...')
    const files = await readdir(scriptsDir)

    const scriptFiles = files
      .filter((file) => {
        const shouldInclude = isNumberedScript(file)
        const shouldExclude = excludePatterns.some((pattern) => pattern.test(file))
        return shouldInclude && !shouldExclude
      })
      .sort(sortScripts)

    console.log(`✅ Found ${scriptFiles.length} script files to include:`)
    scriptFiles.forEach((file) => console.log(`   - ${file}`))

    const parts: string[] = []
    parts.push('-- ============================================================================')
    parts.push('-- AUTO-GENERATED SEED FILE')
    parts.push('-- DO NOT EDIT MANUALLY - This file is generated from scripts/*.sql')
    parts.push('-- Run: bun generate-seed.ts')
    parts.push('-- ============================================================================\n')

    for (const file of scriptFiles) {
      const filePath = join(scriptsDir, file)
      const content = await readFile(filePath, 'utf-8')

      parts.push(`-- ============================================================================`)
      parts.push(`-- File: ${file}`)
      parts.push(
        `-- ============================================================================\n`
      )
      parts.push(content.trim())
      parts.push('\n')
    }

    const seedContent = parts.join('\n')
    await writeFile(seedFile, seedContent, 'utf-8')

    console.log(`\n✅ Successfully generated seed.sql`)
    console.log(`   Total files: ${scriptFiles.length}`)
    console.log(`   Output: ${seedFile}`)
    console.log(`   Size: ${(seedContent.length / 1024).toFixed(2)} KB`)
  } catch (error) {
    console.error('❌ Error generating seed.sql:', error)
    process.exit(1)
  }
}

generateSeed()
