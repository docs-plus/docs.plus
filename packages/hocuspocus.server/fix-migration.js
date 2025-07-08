#!/usr/bin/env bun

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixMigration() {
  try {
    console.log('🔍 Checking migration status...')

    // Check if the commitMessage column exists
    const result = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Documents' AND column_name = 'commitMessage'
    `

    const columnExists = result.length > 0

    if (columnExists) {
      console.log('✅ commitMessage column already exists. Marking migration as successful...')

      // Mark the migration as successful
      await prisma.$queryRaw`
        UPDATE "_prisma_migrations"
        SET finished_at = NOW(), success = true
        WHERE migration_name = '20250423053812_new_init'
      `
    } else {
      console.log('🔧 Adding commitMessage column...')

      // Add the missing column
      await prisma.$queryRaw`ALTER TABLE "Documents" ADD COLUMN "commitMessage" TEXT`

      // Mark the migration as successful
      await prisma.$queryRaw`
        UPDATE "_prisma_migrations"
        SET finished_at = NOW(), success = true
        WHERE migration_name = '20250423053812_new_init'
      `
    }

    console.log('✅ Migration fixed successfully!')
  } catch (error) {
    console.error('❌ Error fixing migration:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

fixMigration()
