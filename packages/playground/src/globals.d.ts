// Forward guard, inert today: a `*.css` ambient so a consumer playground's
// main.ts `import '...styles.css'` typechecks IF that file is ever added to a
// tsconfig include. Travels to consumers via the setup.ts triple-slash ref.
declare module '*.css'
