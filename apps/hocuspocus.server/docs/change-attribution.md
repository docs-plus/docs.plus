# Change attribution

Per-range authorship on a version diff is **best-effort provenance, not an audit trail.** Treat it
the way you would a `git blame` on a repository where everyone shares a push key. It is useful for
"who was working here", never evidence of who wrote a line.

## What is captured

`onChange` is the only hook that sees a Yjs `update` and the authenticated `context` together, so
that is where a clientID is bound to a user. Bindings live in `DocumentClientAuthor`
(`documentId`, `clientId`) → (`userId`, `isAnonymous`), written once per pair and never updated.

The binding stores a raw Supabase `sub`, never a name. Identity resolves at read time against
`public.users`, so an anonymous editor who later signs up upgrades their whole history with no
backfill. Supabase keeps the same `auth.users.id` across that conversion.

## What the guard does, and does not, prove

A clientID is bound only when the socket announced it through awareness, the connection carries a
user, and the document is not a draft. That rules out the accidental mis-binding this guard exists
for. A reconnecting client replays another user's structs, and a naive binder would credit them to
the reconnector.

It does not prove ownership, and cannot:

- y-protocols accepts whatever clientID a socket announces, with no ownership check.
- Yjs authenticates no authorship at all. Any client may set `doc.clientID` to a value it observed
  — every peer's clientID is visible in the synced document — and type under it.

Detecting that would mean decoding every update to compare its authors against the socket's user,
which costs the hot path its whole performance budget. It is also not a docs.plus-specific gap:
CRDT collaboration has no authenticated authorship, and the paid alternatives share the property.

The trust boundary is therefore **write access**. Anyone who can edit a document can influence what
that document's diff attributes. Since document privacy here is login-gated rather than
membership-gated, that population is every signed-in user.

## What the diff engine sees

A separate limit, in the layer above. The version compare view diffs two documents with
`prosemirror-changeset`, reached through `@tiptap/pm/changeset`. Its own documentation states the
default: "The default is to just compare nodes by name and text by character, ignoring marks and
attributes."

So the default encoder is blind to three real edits. Text made bold, a link whose address changed
while its words did not, and a heading moved from one level to another all report zero changes. A
reader would see an unchanged document while the edit was really there.

**This tree therefore passes its own encoder.** `ChangeSet.create` takes a `TokenEncoder` as its
third argument, added in `prosemirror-changeset@2.3.0`, and
`apps/webapp/src/components/pages/history/utils/diffTokenEncoder.ts` supplies one. It interns each
distinct mark set to an integer, so a character carries its formatting into the comparison. Node
tokens carry their attributes, minus `toc-id`, which the first browser open rewrites and which is
therefore identity churn rather than an edit.

Two things follow for anyone changing that file. Interning to integers is not a style choice: it
keeps the library's cheap prefix and suffix trim alive, which a fresh object per character
destroys. And the version is load-bearing — `@tiptap/pm` declares `prosemirror-changeset: "^2.3.0"`,
so only the lockfile pins the version that carries the third argument.

The block comparison on this side of the wire never had this blindness. `canonicalizeBlock` hashes
each top-level block from its whole JSON, marks and attributes included, and strips only
`VOLATILE_BLOCK_ATTRS`. Its granularity is a whole block rather than a character range.

## Failure mode

Absence, never a wrong name. Where the guard cannot decide, it writes nothing and the range reads as
unattributed — the same path every version row written before this feature takes. A binding can move
a range from unattributed to attributed as it lands, but never from one user to another.

## Do not

- Present this as an audit log, or use it to settle a dispute about who changed something.
- Store a display name in the binding row. Read-time resolution is what makes the anonymous upgrade
  work.
- Add a decode-every-update check to close the forgery gap without measuring the cost first; the
  steady-state hook currently does zero decodes.
