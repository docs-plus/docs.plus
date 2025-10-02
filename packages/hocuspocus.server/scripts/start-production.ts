#!/usr/bin/env bun

import { $ } from 'bun'
import chalk from 'chalk'

async function startProduction() {
  try {
    console.log(chalk.blue('🚀 Starting production server...'))

    // Run database migrations
    console.log(chalk.yellow('📦 Running database migrations...'))
    await $`bunx prisma migrate deploy`

    console.log(chalk.green('✅ Migrations completed successfully'))

    // Start the main application
    console.log(chalk.cyan('🎯 Starting main application...'))
    await import('./src/index')
  } catch (error: any) {
    console.error(chalk.red('❌ Migration failed:'), error.message)

    if (error.message.includes('P3009')) {
      console.log(chalk.yellow('🔧 Attempting to fix failed migration...'))

      try {
        await $`bun scripts/fix-migration.ts`
        console.log(chalk.green('✅ Migration fixed, retrying...'))

        // Retry migrations
        await $`bunx prisma migrate deploy`
        console.log(chalk.green('✅ Migrations completed successfully'))

        // Start the main application
        console.log(chalk.cyan('🎯 Starting main application...'))
        await import('./src/index')
      } catch (fixError: any) {
        console.error(chalk.red('❌ Failed to fix migration:'), fixError.message)
        process.exit(1)
      }
    } else {
      console.error(chalk.red('❌ Unexpected error:'), error.message)
      process.exit(1)
    }
  }
}

startProduction()
