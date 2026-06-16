// Test preload: src/config/env.schema.ts calls process.exit(1) at import time
// when required vars (DATABASE_URL/SUPABASE_*) are unset, which aborts the whole
// run. Seed harmless defaults so importing src modules under test does not exit.
// Real values (CI services, local .env) win — we only fill gaps.
const defaults: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/postgres',
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_ANON_KEY: 'test-anon-key'
}

for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) process.env[key] = value
}
