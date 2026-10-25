#!/usr/bin/env bun

import { $ } from 'bun'

async function fixMigration() {
  try {
    console.log('🔧 Fixing migration state...')

    // Mark failed migration as rolled back
    await $`bunx prisma@7.10.1 migrate resolve --rolled-back "init"`

    console.log('✅ Migration state fixed')
  } catch (error: any) {
    console.error('❌ Failed to fix migration:', error.message)
    process.exit(1)
  }
}

fixMigration()
