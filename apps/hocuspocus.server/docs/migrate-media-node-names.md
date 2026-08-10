# Migrate media node names (PascalCase → camelCase)

Rewrite stored hypermultimedia media node types across full document history to match the 2.0 rename in `@docs.plus/extension-hypermultimedia` (`Image→image`, `Video→video`, `Audio→audio`, `Youtube→youtube`, `Vimeo→vimeo`, `SoundCloud→soundcloud`, `Twitter→x`).

## When to run

Once, after deploying the 2.0 camelCase extension. Yjs documents written by 1.x still hold PascalCase node types; this migration rewrites them.

## Prerequisites

1. Deploy the camelCase extension, the client IndexedDB key bump, and the on-load shim (`ENABLE_SCHEMA_MIGRATION=true`) **first**, so live clients tolerate both states.
2. Take a database snapshot.

## Steps

Run from `apps/hocuspocus.server`:

1. Audit (no writes) — review counts and the failure JSON (see below if it is not empty):
   ```bash
   bun run src/scripts/migrate-media-node-names.ts --dry-run
   ```
2. One document on staging or a copy, then open it in the editor and confirm media renders:
   ```bash
   bun run src/scripts/migrate-media-node-names.ts --doc <id>
   ```
3. Full migration, in a low-traffic window:
   ```bash
   bun run src/scripts/migrate-media-node-names.ts
   ```

## If the audit reports failures

`encode_yjs: Unknown node type: undefined` marks a document whose stored fragment holds schema-invalid content (Yjs merge artifacts: typeless text runs directly under `doc`). The batch skips the whole document, and the on-load shim fails the same encode and serves the original bytes — neither path migrates it. Repair these documents individually: a 2.0 client cannot instantiate their legacy nodes and will render (and, on edit, persist) the document without them. Re-run the audit after.

## Verification

Re-run `--dry-run`: it reports zero rows to migrate. Spot-check documents that contained media.

## After the batch

Keep `ENABLE_SCHEMA_MIGRATION` on through the migration window plus a short grace period — it lazily migrates stragglers (documents written between the batch and now). Then turn it **off**. Left on, it runs the rename check on every document load and carries the memory ceiling below.

## Data-loss posture

Per document, every history row is planned: decode → rename → encode → round-trip → assert no legacy media types remain. If any row fails, the whole document is skipped — never partial history. One interactive transaction per document; `UPDATE` by `id`+`version` (optimistic lock); no `DELETE`/`INSERT`; only `data` bytes change.

Webapp-only stored attrs (`paragraphStyle`, `toc-id` on tables and hyperlink marks, hyperlink `rel`/`class`/`title`) are registered in `migration-extensions.ts`, so re-encode preserves their stored values. ProseMirror silently drops attrs its schema does not know.

## Memory ceiling

Per document, the script loads every history row and holds all re-encoded buffers until one transaction commits. Peak memory is O(versions × document size), each row a full snapshot. A single document with very deep history can exhaust process memory. The per-document transaction is the atomicity boundary, so this is deliberately not chunked. Migrate an unusually large document on its own with `--doc <id>` on a host with adequate memory.
