#!/usr/bin/env bun

import { $ } from 'bun'

async function startProduction() {
  try {
    console.log('🚀 Starting production server...')

    // First, try to run migrations
    console.log('📦 Running database migrations...')
    await $`bunx prisma migrate deploy`

    console.log('✅ Migrations completed successfully')

    // Start the main application
    console.log('🎯 Starting main application...')
    await import('./index.js')
  } catch (error) {
    console.error('❌ Migration failed:', error.message)

    if (error.message.includes('P3009')) {
      console.log('🔧 Attempting to fix failed migration...')

      try {
        await $`bun fix-migration.js`
        console.log('✅ Migration fixed, retrying...')

        // Retry migrations
        await $`bunx prisma migrate deploy`
        console.log('✅ Migrations completed successfully')

        // Start the main application
        console.log('🎯 Starting main application...')
        await import('./index.js')
      } catch (fixError) {
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
