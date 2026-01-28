module.exports = {
  // TypeScript/JavaScript files: lint, format, type-check
  'packages/**/*.{ts,tsx}': [
    'eslint --fix --max-warnings=0',
    'prettier --write',
  ],
  'packages/**/*.{js,jsx}': [
    'eslint --fix',
    'prettier --write',
  ],
  // Config and docs: format only
  'packages/**/*.{json,md,yml,yaml}': ['prettier --write'],
  // CSS/SCSS: format
  'packages/**/*.{css,scss}': ['prettier --write'],
}
