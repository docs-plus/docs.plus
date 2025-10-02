module.exports = {
  'packages/**/*.{js,jsx,ts,tsx}': ['eslint --fix', 'prettier --write'],
  'packages/**/*.{json,md,yml,yaml}': ['prettier --write']
}
