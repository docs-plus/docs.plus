#!/usr/bin/env bun
/**
 * Generate seed.sql from numbered script files
 *
 * This script reads all files in the scripts/ directory that start with numbers
 * (like 01-enum.sql, 02-users.sql, etc.) and concatenates them into seed.sql
 * in the correct order.
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const rootDir = import.meta.dir;
const scriptsDir = join(rootDir, 'scripts');
const seedFile = join(rootDir, 'seed.sql');

// Files to exclude (test files, non-schema files)
const excludePatterns = [
  /^test_/i,
  /^dummy_/i,
  /^idea\.sql$/i,
];

// Files that start with numbers (e.g., 01-, 02-, 10-0-, etc.)
const isNumberedScript = (filename: string): boolean => {
  return /^\d+/.test(filename) && filename.endsWith('.sql');
};

// Sort function that handles numbered prefixes properly
// e.g., 01-enum.sql, 02-users.sql, 03-0-workspaces.sql, 03-1-members.sql
// Handles: 10-0-func-helpers.sql, 10-0-1-triggers.sql, 10-functions.sql
// Logic: Sub-numbered files (10-0, 10-0-1) come before non-sub-numbered (10-functions)
const sortScripts = (a: string, b: string): number => {
  // Extract numeric prefixes
  const getNumericPrefix = (name: string): { major: number; sub1: number; sub2: number; hasSubNumbers: boolean } => {
    const match = name.match(/^(\d+)(?:-(\d+))?(?:-(\d+))?/);
    if (!match) return { major: 0, sub1: 0, sub2: 0, hasSubNumbers: false };

    // Check if this is a sub-numbered file (has -digit after the first number)
    const hasSubNumbers = !!(match[2] || match[3]);

    return {
      major: parseInt(match[1] || '0', 10),
      sub1: parseInt(match[2] || '0', 10),
      sub2: parseInt(match[3] || '0', 10),
      hasSubNumbers,
    };
  };

  const dataA = getNumericPrefix(a);
  const dataB = getNumericPrefix(b);

  // 1. Compare major number
  if (dataA.major !== dataB.major) {
    return dataA.major - dataB.major;
  }

  // 2. If same major, files WITH sub-numbers come before files WITHOUT
  // This ensures 10-0, 10-0-1, 10-1 come before 10-functions
  if (dataA.hasSubNumbers !== dataB.hasSubNumbers) {
    return dataA.hasSubNumbers ? -1 : 1;
  }

  // 3. Compare sub-numbers (only relevant when both have sub-numbers)
  if (dataA.sub1 !== dataB.sub1) {
    return dataA.sub1 - dataB.sub1;
  }
  if (dataA.sub2 !== dataB.sub2) {
    return dataA.sub2 - dataB.sub2;
  }

  // 4. If all numeric parts are equal, sort alphabetically
  return a.localeCompare(b);
};

async function generateSeed() {
  try {
    console.log('📦 Reading scripts directory...');
    const files = await readdir(scriptsDir);

    // Filter: numbered SQL files, exclude test files
    const scriptFiles = files
      .filter((file) => {
        const shouldInclude = isNumberedScript(file);
        const shouldExclude = excludePatterns.some((pattern) => pattern.test(file));
        return shouldInclude && !shouldExclude;
      })
      .sort(sortScripts);

    console.log(`✅ Found ${scriptFiles.length} script files to include:`);
    scriptFiles.forEach((file) => console.log(`   - ${file}`));

    // Read and concatenate all files
    const parts: string[] = [];
    parts.push('-- ============================================================================');
    parts.push('-- AUTO-GENERATED SEED FILE');
    parts.push('-- DO NOT EDIT MANUALLY - This file is generated from scripts/*.sql');
    parts.push('-- Run: bun generate-seed.ts');
    parts.push('-- ============================================================================\n');

    for (const file of scriptFiles) {
      const filePath = join(scriptsDir, file);
      const content = await readFile(filePath, 'utf-8');

      parts.push(`-- ============================================================================`);
      parts.push(`-- File: ${file}`);
      parts.push(`-- ============================================================================\n`);
      parts.push(content.trim());
      parts.push('\n'); // Add spacing between files
    }

    // Write to seed.sql
    const seedContent = parts.join('\n');
    await writeFile(seedFile, seedContent, 'utf-8');

    console.log(`\n✅ Successfully generated seed.sql`);
    console.log(`   Total files: ${scriptFiles.length}`);
    console.log(`   Output: ${seedFile}`);
    console.log(`   Size: ${(seedContent.length / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error('❌ Error generating seed.sql:', error);
    process.exit(1);
  }
}

generateSeed();

