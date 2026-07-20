/** Reads a required process env var; points operators at the repo-root env file. */
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} is required. Load it via bun --env-file=../../.env.local (missing from environment).`
    )
  }
  return value
}
