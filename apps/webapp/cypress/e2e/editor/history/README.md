# History Cypress

Scope: document-route `#history` E2E (sidebar interaction, version switch, restore) when a store-seed or WS intercept harness exists.

## Coverage today

Row projection and collapse logic: **Jest** — `apps/webapp/src/components/pages/history/utils/sidebarRows.test.ts`.

The document route does not expose `window._store` (only `/editor` playground does). Do not duplicate projection logic in `cypress/support/` — keep a single source of truth in `utils/sidebarRows.ts`.

## Prerequisites for DOM E2E

- Hocuspocus WebSocket (`dev:ws`, port 4001), or
- Dev-only store seed on the document page for `historyList` / `activeHistory`.

## Running Jest projection tests

```bash
bun run --filter @docs.plus/webapp test -- --testPathPatterns=sidebarRows
```
