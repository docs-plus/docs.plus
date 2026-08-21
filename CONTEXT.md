# Domain glossary

Shared names for docs.plus domain concepts. Architecture reviews and deepenings use these terms at seams.

## Pad outline

- **Title** — the first line of the document. Always a heading. Its Block style cannot change.
- **Block style** — the outline role of the caret block: Title, Subtitle, heading level 1–6, or Normal. Not visual size.
- **Subtitle** — a paragraph style, not a heading. It is not a TOC heading.
- **HeadingScale** — visual size by rank inside a section. Distinct from Block style. The same heading level can look larger or smaller depending on the section.
- **Heading slug trail** (`?h=`) — outline ancestry from the target heading up through each parent to Title. Not a join of every heading before the target. `id=` is the resolver.

## Document access

- **Private** — only the owner may open the document (REST slug + WS room sealed).
- **Read-only** — non-owners may view but not edit; owners remain editable. Turning Private ON clears Read-only and disables the control until the doc is public again.
- **PrivateAccess** — server decision: `allow` | `sign-in-required` | `denied` (`resolvePrivateAccess`).
- **PrivateGateVariant** — UI CTA after a blocked open: `sign-in-required` | `access-denied` | `check-unavailable` (`toPrivateGateVariant`). The third is a degraded backend (503 `AUTH_UNAVAILABLE`) that decided nothing, so its CTA retries instead of offering sign-in.
- **Access mutation** — the owner changing Private/Read-only (`isDocumentOwner`, `useDocumentAccessMutation`). An ownerless document has nobody to be private for, so its locks do not move.
- **Open document** — a document with no `ownerId`. Anyone may retitle it, signed in or not; its Private/Read-only locks are refused until ownership handoff ships.
- **Live seal** — REST publish → Redis `doc:{id}:access` → WS broadcast/close → client `applyAccessStateless`.
- **Editing lock** — client cannot edit: content-fork error, `authorizedScope === 'readonly'`, or metadata Read-only for a non-owner (`selectDocumentEditingLocked`).

## Chat media gallery

- **GallerySession** — pure playlist snapshot + index (`beginGallerySession` / `stepGallerySession` + `GALLERY_SESSION_CLOSED` in `gallerySession.ts`); the Zustand store clears transient handles around those calls.
- **GalleryActiveSlide** — identity-keyed zoom/media command registry colocated in `chatMediaGalleryStore.ts` (HMR-safe singleton; inactive unmount must not clear the active handle).
- **GalleryActiveMediaUrl** — sync resolved URL for copy/open on the click gesture (`publishGalleryActiveMediaUrl` / `readGalleryActiveMediaUrl` in the same store module — not a Zustand field).
- **Gallery playlist** — lightbox order is intentionally images → videos → audio (not feed mosaic / attachment order); built by `openGallerySession` inside `beginGallerySession`. Do not reorder to match the feed album.

## Chat feed album

- **FeedAlbumLayout** — feed mosaic for image/video tiles: `computeVisualMediaLayout` → `single | mosaic` absolute rects (`chatMediaVisualLayout.ts` orchestrates `feedAlbumProportionLayout` for 2–4 and `feedAlbumRowPacker` for ≥5 / panorama); geometry + cap policy in `feedAlbumLayout.ts` (`resolveFeedLayoutOptions`). Attach cap stays `CHAT_MEDIA_MAX_ATTACHMENTS` (10) at compose time — no feed `+N`. Distinct from Gallery playlist order. Domain names only (no vendor product names in symbols/filenames).
- **FeedColumnWidth** — definite column contract so absolute cover tiles do not shrink-wrap: media card `FEED_COLUMN_MEDIA_CARD_CLASS`, bubble fill `FEED_COLUMN_BUBBLE_FILL_CLASS`, measure via `resolveFeedColumnElement` / `clampFeedColumnWidth` (bubble ≥160px else `.message-feed`).

## Mobile pad split

- **Chat pane** — the mobile chat surface as a layout participant in the pad shell, sized to its visible height so its composer stays reachable. Distinct from the desktop docked chat panel and from the retired mobile chat sheet; do not call it either.
- **Pane mode** — one of the chat pane's positions: closed, half, or expanded. Named after the sibling precedent `ComposerEmojiPanelMode`. Not "full", which would imply the pane can cover the document, and not "snap" or "detent", which belong to `react-modal-sheet` and UIKit.
- **Split ratio** — the fraction of the pad shell the chat pane occupies in half mode. Always a fraction, never a pixel height, so a keyboard that shrinks the shell preserves the split instead of breaking it.
- **Document floor** — the height the document keeps in every pane mode, so its last section is always reachable. The chat pane can never cover it, which is why no mode collapses the document to zero.
- **Pane floor** — the chat pane's minimum height, the sum of its non-shrinkable furniture: grabber, header, feed padding, composer. Measure it; an estimate that omits the feed's own padding pushes the composer off-screen.
- **Pane shell measure** — the live pad-shell height, the height the pad header reserves, and the chat pane's bottom safe-area inset. The Chat pane and its grabber both size from this measure. Not a constant.

## Presence awareness

- **usersPresence** — Map of online Profiles keyed by user id (`useStore.usersPresence`); TOC heading stacks filter by `channelId`.
- **presenceSync** — broadcast of `{id,channelId}` rows only (`workspacePresenceSync.ts`). Never creates face-less stub Profiles; attaches `channelId` to existing rows or buffers until a full track/broadcast profile arrives. Buffers die with the subscription (`clearPresenceSyncBuffers` via `clearAllPresenceShareTimers` on resubscribe).
- **selectPresenceOthers** — filter self out of presence stacks (`PresentUsers`, `usePresentUsers`); pass `map.values()` or a channel list.
- Avatar stacks never render stub-only id/`channelId` rows.

## Document swarm

- **Swarm Actor** — a seeded, reusable authenticated identity used by the document swarm. Distinct from an anonymous viewer; can track presence, edit the pad, and send chat as itself.
- **Swarm Target** — a document URL the swarm may open. v1: must be public and not Read-only (and not soft-deleted); otherwise the swarm refuses to start.
- **Demo mode** — paced fake collaboration meant to be watched on a live pad (join, write, format, heading chat).
- **Stress mode** — same Swarm Actors and Swarm Target, higher concurrency and tighter loops to probe load. Not a separate product — a mode of the same swarm.
- **Swarm Host** — an allowlisted deployment the swarm may hit (local or stage). Production hosts are out of scope.
- **Swarm Script** — a named, fixed collaboration routine (e.g. prose, task-list, academy, chat) an actor can run.
- **Shuffle** — optional assignment mode: actors draw Swarm Scripts from a weighted pool instead of a fixed round-robin. Default remains deterministic assignment.
- **Write Target** — the pad section a Swarm Actor may type under for one script turn (not the Swarm Target document URL). Opaque to Swarm Scripts: Contention policy resolves it inside the pad module; scripts never see heading labels or RunOptions.
- **Heading Chat Surface** — pad-adjacent seam for opening a heading's chatroom and sending lines (TOC trigger, heading-action fallback, composer). Swarm Scripts call it; they do not own those selectors.
- **Contention** — how aggressively actors share the same Write Target. Demo defaults low (section-isolated); Stress defaults high (shared hotspot). Overridable by flag.
- **Swarm Run** — one invocation of the swarm against a Swarm Target. Stops on duration expiry, Ctrl+C, or `--until-stopped` operator kill.
- **Ramp** — staggered actor join over a window at the start of a Swarm Run. Default join pattern; optional churn (leave/rejoin mid-run) is a later add-on.
- **Script Outcome** — what a Swarm Script returns after one turn (success plus optional counters such as chat sends). The Swarm Run folds outcomes into the Swarm Report; scripts never mutate report state.
- **Swarm Report** — end-of-run operator summary for Stress (and optional Demo): joins, script actions, chat sends, errors; hard-failure threshold drives exit code. Reconnects appear only when a real Ramp/churn path increments them. Not a CI gate in v1.
- **Actor cap** — hard ceiling on concurrent Swarm Actors per Swarm Host (local higher than stage); over-cap runs require an explicit force override.

## Face inputs / Stack geometry

- **resolveFace** / **resolveDisplayName** / **toStackUser** (`utils/avatarFace.ts`) — normalize Profile/snake_case and caret camelCase, coalescing the `id` aliases (`user_id`, `member_id`). `<Avatar face={…}>` and `<AvatarStack users={…}>` resolve at the component, so callers pass the raw row; keep `resolveFace`/`toStackUser` for non-Avatar boundaries. Pure; no DiceBear/load stages.
- **Avatar** (`ui/Avatar`) takes `face` as its only identity input and owns `edge` (`ring`|`paper`|`well`|`none`) + bucket → OAuth → DiceBear.
- **stackGeometry** (`utils/avatarStackGeometry.ts`) — `SIZE`/`SPACING`/`TEXT`, `AvatarStackSurface` → `stackSurfaceToEdge` → `avatarEdgeClass`.
- **Custom avatar** — `avatar_updated_at` set ⇒ custom bucket upload; null falls back to OAuth `avatar_url` / DiceBear.
