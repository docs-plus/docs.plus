# Security

Part of the [`@docs.plus/extension-hypermultimedia` README](../README.md).

## Write side: the scheme gate

One scheme gate guards every stored media `src`. It rejects `javascript:`, `data:`, `vbscript:`, `file:` and `blob:`. It strips ASCII control characters first, so `java\tscript:` cannot pass the check as a scheme. Inline images are the one exception: markdown import and the Replace URL form admit `data:image/*`. SVG is excluded, because it carries script.

The gate runs on `parseHTML` for `video`, `audio`, `vimeo` and `youtube`, on markdown import, and in the Replace URL form. It does **not** run in the insert commands, so `setImage`, `setVideo` and `setAudio` store any non-empty string. The kit never re-validates collaborative attributes either. Treat any value you read back off a node as untrusted, and validate host-supplied URLs before you insert them.

## Read side: View original

The read side carries its own allowlist on purpose. View original permits `https:`, `http:`, `blob:` and a root-relative path, because `blob:` is a legitimate source for an uploaded asset. Both `window.open` calls in the kit pass through that check with `noopener,noreferrer`.

## Embeds

Embed URL parsing rejects an invalid host before insert. X and Loom paste paths carry dedicated security specs. Hosts should still validate storage and CSP for an iframe `src` the same way they do for a user-authored link.
