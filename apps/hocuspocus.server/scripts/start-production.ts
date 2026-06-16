#!/usr/bin/env bun

import { $ } from 'bun'

async function startProduction() {
  try {
    console.log('🚀 Starting production server...')

    // Run database migrations
    console.log('📦 Running database migrations...')
    await $`bunx prisma@6.19.3 migrate deploy`

    console.log('✅ Migrations completed successfully')

    // Start the main application
    console.log('🎯 Starting main application...')
    await import('./src/index')
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message)

    if (error.message.includes('P3009')) {
      console.log('🔧 Attempting to fix failed migration...')

      try {
        await $`bun scripts/fix-migration.ts`
        console.log('✅ Migration fixed, retrying...')

        // Retry migrations
        await $`bunx prisma@6.19.3 migrate deploy`
        console.log('✅ Migrations completed successfully')

        // Start the main application
        console.log('🎯 Starting main application...')
        await import('./src/index')
      } catch (fixError: any) {
        console.error('❌ Failed to fix migration:', fixError.message)
        process.exit(1)
      }
    } else {
      console.error('❌ Unexpected error:', error.message)
      process.exit(1)
    }
  }
}

startProduction()
