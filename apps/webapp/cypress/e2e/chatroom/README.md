# Chatroom browser tests

These nine specs render the real chatroom UI against intercepted Supabase HTTP responses.
They cover navigation, pagination, message submission and retry, attachments, gallery behavior, and mobile quick reactions.

## Run locally

The workflow uses Bun 1.4.1 and Node 26.8.2, matching the validated local run.
Install workspace dependencies with `bun install --frozen-lockfile`.
Provide a valid Virtuoso Message List license through `NEXT_PUBLIC_VIRTUOSO_LICENSE`, then run:

```sh
bash scripts/test-chatroom.sh
```

The script builds the extensions and an explicitly opted-in production E2E webapp.
It starts a temporary standalone server on port 3211 and stops that server after the tests.
Set `CHATROOM_PORT` to use another free port.
Keep other Next servers in this checkout stopped while the build runs.

The test environment uses localhost service URLs and dummy authentication.
The shared fixtures seed the `sb-localhost-auth-token` cookie and intercept the HTTP requests.
No running Supabase, Redis, or collaboration server is required.
These tests do not verify database policies, storage persistence, or realtime delivery between clients.

For a prepared E2E server, the shared runner also accepts:

```sh
BASE_URL=http://127.0.0.1:3211 CYPRESS_PARALLEL=1 CI=true \
  bash scripts/run-tests.sh --e2e --scope chatroom
```

Reports and worker logs are written under `Notes/`.
Scoped runs leave the full-suite timing data unchanged.

## CI and remaining coverage

The `Chatroom Browser Tests` workflow runs when relevant files change on `main` or in pull requests from this repository.
Fork and Dependabot pull requests skip this job because they cannot use its license secret.
The workflow also supports manual runs and uploads reports and failure screenshots.
Configure the repository Actions secret `NEXT_PUBLIC_VIRTUOSO_LICENSE` before running it.
The job fails clearly when the license is absent.

The existing media-filter case remains pending because its control is currently unmounted.
The reaction test verifies the held-touch menu and the submitted emoji payload.
Realtime reaction-count updates and the first-send server echo need separate integration coverage.
The production E2E build retains Cypress selectors and disables PWA registration only when `NEXT_PUBLIC_E2E=true`.
Worker activation otherwise reloads the fixture page during interactions.
Service-worker lifecycle behavior needs separate PWA coverage.
Normal production builds retain their existing selector removal and E2E-route exclusion.
