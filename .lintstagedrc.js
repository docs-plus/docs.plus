/**
 * Lint-Staged Configuration
 * =========================
 * Runs on staged files during pre-commit hook.
 *
 * Rules:
 * - TypeScript/TSX: ESLint (fix) + Prettier
 * - JavaScript/JSX: ESLint (fix) + Prettier
 * - CSS/SCSS: Stylelint (fix) + Prettier
 * - JSON/YAML/MD: Prettier only
 * - Public JS files: Prettier only (service workers have special globals)
 */

module.exports = {
  // TypeScript/React files in src directories
  '{apps,extensions,packages}/**/src/**/*.{ts,tsx}': [
    'eslint --fix --max-warnings=0 --no-warn-ignored',
    'prettier --write'
  ],

  // JavaScript/React files in src directories
  '{apps,extensions,packages}/**/src/**/*.{js,jsx}': [
    'eslint --fix --max-warnings=0 --no-warn-ignored',
    'prettier --write'
  ],

  // Public directory files (service workers, etc.) - format only
  '{apps,extensions,packages}/**/public/**/*.{js,ts}': ['prettier --write'],

  // CSS/SCSS files - lint and format
  '{apps,extensions,packages}/**/*.{css,scss}': [
    'stylelint --fix --allow-empty-input',
    'prettier --write'
  ],

  // Config files at root and in packages
  '*.{json,yml,yaml}': ['prettier --write'],
  '{apps,extensions,packages}/**/*.{json,yml,yaml}': ['prettier --write'],

  // Markdown files
  '*.md': ['prettier --write'],
  '{apps,extensions,packages}/**/*.md': ['prettier --write'],

  // Config JS files (eslint, prettier, next, etc.)
  '*.{js,cjs,mjs}': ['prettier --write'],
  '{apps,extensions,packages}/**/*.config.{js,ts,mjs}': ['prettier --write']
}
