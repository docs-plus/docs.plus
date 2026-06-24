/**
 * Lint-Staged Configuration
 * =========================
 * Runs on staged files during pre-commit hook.
 *
 * Prettier writes here; pre-push runs check:push (no full-repo format re-check).
 * CI runs bun run check which includes prettier --check.
 */

module.exports = {
  '{apps,extensions,packages}/**/src/**/*.{ts,tsx}': [
    'eslint --fix --max-warnings=0 --no-warn-ignored',
    'prettier --write'
  ],

  '{apps,extensions,packages}/**/src/**/*.{js,jsx}': [
    'eslint --fix --max-warnings=0 --no-warn-ignored',
    'prettier --write'
  ],

  '{apps,extensions,packages}/**/public/**/*.{js,ts}': ['prettier --write'],

  '{apps,extensions,packages}/**/*.{css,scss}': [
    'stylelint --fix --allow-empty-input',
    'prettier --write'
  ],

  '**/*.{json,yml,yaml}': ['prettier --write'],
  '**/*.md': ['prettier --write'],
  '*.{js,cjs,mjs}': ['prettier --write'],
  '**/*.config.{js,ts,mjs}': ['prettier --write']
}
