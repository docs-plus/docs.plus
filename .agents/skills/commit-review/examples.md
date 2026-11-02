# Commit message examples

## The subject is enough

```text
fix(pad-url): handle an empty path
```

```text
docs(extension-hyperlink): correct the install command
```

```text
test(hocuspocus): cover the expired-token branch
```

```text
chore(deps): bump zod to 3.23.8
```

## A body that gives the why

```text
feat(webapp): add an inline code toggle to the toolbar

The button and Mod+E wrap the current selection. Google Docs and
Notion use the same shortcut, so users already try it.
```

```text
fix(webapp): restore the active tab highlight after navigation

The route-change handler overwrote the active state before the
highlight effect read it.

Closes #412
```

```text
perf(webapp): load the extension bundles on first use

The table and image extensions now load only when their nodes
appear. The first bundle is about 40% smaller.
```

## Breaking change

```text
feat(hocuspocus): require a bearer token on the documents API

BREAKING CHANGE: a call to /api/documents without a token now
returns 401. Send the token from the admin settings page.
```

## Revert

```text
revert(webapp): restore the old share dialog

This reverts commit 03d29d78f1c2a9e0b5d4f7a6c3e8b1d2f0a9c4e7.
The new dialog hid the copy-link button on narrow screens.
```

## Deploy trigger

Only when the maintainer asks for a deploy, and always as the last commit.

```text
(build): front back
```
