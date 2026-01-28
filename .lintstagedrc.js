module.exports = {
  // TypeScript/JavaScript files: lint, format
  'packages/**/src/**/*.{ts,tsx}': [
    'eslint --fix --max-warnings=0',
    'prettier --write',
  ],
  'packages/**/src/**/*.{js,jsx}': [
    'eslint --fix',
    'prettier --write',
  ],
  // Public files: format only (no lint - service workers have special globals)
  'packages/**/public/**/*.{js,ts}': ['prettier --write'],
  // Config and docs: format only
  'packages/**/*.{json,md,yml,yaml}': ['prettier --write'],
  // CSS/SCSS: format
  'packages/**/*.{css,scss}': ['prettier --write'],
}
