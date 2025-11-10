# Environment Variables

## Docker Compose (Recommended)

When running via Docker Compose (`make up-dev` or `make up-prod`), **all environment variables come from the root `.env.development` or `.env.production` file**. Package-level `.env` files are **ignored** by Docker Compose.

## Local Development (Without Docker)

If you run the webapp directly without Docker (`bun run dev`), create a `.env.local` file in this directory with the required variables from the root `.env.example`.

**Note:** Package-level `.env` files are not included in the repository. For Docker-based development (recommended), use the root `.env.development` file.

## Required Variables

See root `.env.example` for the complete list of environment variables.

Key variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_PROVIDER_URL`
- `NEXT_PUBLIC_RESTAPI_URL`
