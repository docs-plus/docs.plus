#!/usr/bin/env bun

import { $ } from 'bun'
import chalk from 'chalk'

async function fixMigration() {
  try {
    console.log(chalk.yellow('🔧 Fixing migration state...'))

    // Mark failed migration as rolled back
    await $`bunx prisma migrate resolve --rolled-back "init"`

    console.log(chalk.green('✅ Migration state fixed'))
  } catch (error: any) {
    console.error(chalk.red('❌ Failed to fix migration:'), error.message)
    process.exit(1)
  }
}

fixMigration()
