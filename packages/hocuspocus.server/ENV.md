# Environment Variables

## Docker Compose (Recommended)

When running via Docker Compose (`make up-dev` or `make up-prod`), **all environment variables come from the root `.env.development` or `.env.production` file**. Package-level `.env` files are **ignored** by Docker Compose.

## Local Development (Without Docker)

If you run services directly without Docker (`bun run dev:rest`, `bun run dev:hocuspocus.server`, etc.), create a `.env.development` file in this directory with the required variables from the root `.env.example`.

**Note:** Package-level `.env` files are not included in the repository. For Docker-based development (recommended), use the root `.env.development` file.

## Required Variables

See root `.env.example` for the complete list of environment variables.

Key variables:
- `DATABASE_URL`
- `REDIS_HOST`, `REDIS_PORT`
- `JWT_SECRET`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`

