/**
 * Lint-Staged Configuration
 * =========================
 * Runs on staged files during pre-commit hook.
 *
 * bun fmt writes here; husky pre-push runs check:ci (includes format).
 * CI lint job runs bun run lint, bun run format, and bun run lint:styles.
 */

module.exports = {
  '{apps,extensions,packages}/**/src/**/*.{ts,tsx}': [
    'eslint --fix --max-warnings=0 --no-warn-ignored',
    'bun fmt'
  ],

  '{apps,extensions,packages}/**/src/**/*.{js,jsx}': [
    'eslint --fix --max-warnings=0 --no-warn-ignored',
    'bun fmt'
  ],

  '{apps,extensions,packages}/**/public/**/*.{js,ts}': ['bun fmt'],

  '{apps,extensions,packages}/**/*.{css,scss}': ['stylelint --fix --allow-empty-input', 'bun fmt'],

  '**/*.{json,yml,yaml}': ['bun fmt'],
  '**/*.md': ['bun fmt'],
  '*.{js,cjs,mjs}': ['bun fmt'],
  '**/*.config.{js,ts,mjs}': ['bun fmt']
}
