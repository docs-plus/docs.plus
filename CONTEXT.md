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
- **Gallery playlist** — lightbox order images → videos → audio (not feed mosaic order); built by `openGallerySession` inside `beginGallerySession`.
