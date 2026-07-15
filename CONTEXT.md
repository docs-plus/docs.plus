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
