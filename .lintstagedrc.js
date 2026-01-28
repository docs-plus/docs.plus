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
  'packages/**/src/**/*.{ts,tsx}': ['eslint --fix --max-warnings=0', 'prettier --write'],

  // JavaScript/React files in src directories
  'packages/**/src/**/*.{js,jsx}': ['eslint --fix --max-warnings=0', 'prettier --write'],

  // Public directory files (service workers, etc.) - format only
  'packages/**/public/**/*.{js,ts}': ['prettier --write'],

  // CSS/SCSS files - lint and format
  'packages/**/*.{css,scss}': ['stylelint --fix --allow-empty-input', 'prettier --write'],

  // Config files at root and in packages
  '*.{json,yml,yaml}': ['prettier --write'],
  'packages/**/*.{json,yml,yaml}': ['prettier --write'],

  // Markdown files
  '*.md': ['prettier --write'],
  'packages/**/*.md': ['prettier --write'],

  // Config JS files (eslint, prettier, next, etc.)
  '*.{js,cjs,mjs}': ['prettier --write'],
  'packages/**/*.config.{js,ts,mjs}': ['prettier --write']
}
