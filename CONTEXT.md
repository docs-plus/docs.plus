# Domain glossary

Shared names for docs.plus domain concepts. Architecture reviews and deepenings use these terms at seams.

## Document access

- **Private** — only the owner may open the document (REST slug + WS room sealed).
- **Read-only** — non-owners may view but not edit; owners remain editable. Turning Private ON clears Read-only and disables the control until the doc is public again.
- **PrivateAccess** — server decision: `allow` | `sign-in-required` | `denied` (`resolvePrivateAccess`).
- **PrivateGateVariant** — UI CTA after a blocked open: `sign-in-required` | `access-denied` (`toPrivateGateVariant`).
- **Access mutation** — owner (or ownerless first-claimer) changing Private/Read-only (`canMutateAccessFlags`, `useDocumentAccessMutation`).
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
