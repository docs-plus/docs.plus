# Mobile chat splits the viewport as a layout pane, not a partially snapped sheet

Status: Accepted · Date: 2026-07-29

## Context

We want the user to hold chat at half the viewport, with the document visible, interactive, and independently scrollable, and with a defined keyboard behavior.

Mobile chat renders in a `react-modal-sheet` portaled to `document.body`, outside `.mobileLayoutRoot`. Its snap ladder is `[0, 0.7, 0.8, 0.9, 1]`. Three detectors decide its height when the keyboard opens: the library's own, the app's geometric one in `virtualKeyboardMetrics.ts`, and a `focusin` listener in `BottomSheet.tsx`.

One measured constraint decides the design. The library sizes its container to a fixed height and positions it with `transform: translateY`. At any snap below the top, content anchored to the container's bottom falls below the viewport. A prototype at 390×844 put the sheet at a 0.5 snap: the container spanned 422 to 1266, and the composer sat 422px off-screen.

That also explains the behavior we already ship. Forcing `detent: 'full'` on composer focus is what makes the composer reachable. Keyboard avoidance is the secondary effect, not the reason.

## Decision

Chat becomes a flex child of `.mobileLayoutRoot` with three modes: closed, half, and expanded. Its height equals its visible height, so the composer stays anchored to the bottom of the shell and remains reachable in every mode.

One clamp sizes the pane in every mode: `clamp(ratio × shell, paneFloor, shell − title − documentFloor)`. The upper bound is what keeps the document's last section reachable, so no mode collapses the document to zero. Expanded is not a special case; it is the ratio pushed to 1 and caught by that bound.

The split is a fraction of the shell, never a pixel height. `.mobileLayoutRoot` is sized by `--visual-viewport-height`, so the keyboard shrinks both panes and the ratio survives. Measured in the prototype at a 96px document floor and a 176px pane floor: an iPhone 14 with the keyboard open gives chat 254px and the document 198px in half mode, and chat 356px with the document at its floor in expanded mode. An iPhone SE with the keyboard open gives chat 176px and the document 99px. The composer is reachable and the document's end is visible in all of them. The mechanism is confirmed on real iOS Safari, not only in emulation: an absolutely sized flex child inside a `position: fixed` shell whose height comes from `--visual-viewport-height` behaves as measured when the soft keyboard opens. Android Chrome is not yet checked.

The document is scroll-only in half mode, so chat always owns the keyboard. `useAdjustEditorSizeForChatRoom` stops running on mobile. The 20px drag handle becomes a 44px button with a keyboard path.

## Alternatives

**A partially snapped sheet, re-anchored into the shell.** Pass `mountPoint` and override the sheet root's `position` to `absolute`. The library allows both: `style` is spread last over its own root styles. Roughly 30 lines, and the fractions do track the keyboard once re-anchored, with the library's tuned physics intact. Rejected on the measurement above: the user can read the conversation but cannot reply. Do not re-propose this without first changing how the library positions its container.

**A non-modal overlay left portaled to the body.** Rejected. The sheet stays fixed to the layout viewport, so its fractions ignore the keyboard and the composer ends up underneath it.

**Keeping `avoidKeyboard`.** Rejected. It animates to the last snap point on any focus inside the sheet, so a held half mode is impossible.

## Consequences

Leaving the library surrenders the tuned drag and flick physics in its internal `snap.ts`. Modes are discrete by choice; free-form drag is deferred, not overlooked.

Removing `'chatroom'` from `SheetType` breaks comment-intent composer focus and insert-into-chat. Both gate on `isSheetOpen('chatroom')` and `sheetState`, and neither is a type error. Rewrite them against the pane's own open signal in the same change.

The nested reaction-emoji `Sheet` inside `ChatContainerMobile` needs no change. It passes no `mountPoint`, so the library portals it to `document.body`; moving `ChatContainerMobile` into the shell moves the React element, not the DOM. It never participates in flex layout, so it cannot re-earn the dead-space hazard described in `MobileLayout.tsx`. Its second keyboard detector exists only while the picker is open, because the library gates that hook on `isOpen && avoidKeyboard`.

`ToolbarMobile` mounts on a global keyboard flag. As a `shrink-0` sibling it would render pad controls under the chat and steal height from both panes. It needs a focus-ownership predicate. Keep that predicate separate from the access editing lock, which `CONTEXT.md` reserves for a durable permission concept.

The pane floor must be derived from the pane's non-shrinkable furniture, not estimated. Measured at 170px: grabber 44, header 45, feed padding 20, composer 61. The feed is `flex-1 min-h-0` but its own padding does not shrink, so a floor that omits it pushes the composer off-screen — 5px in the prototype, which is enough to make the send button unreachable.

Because the document never reaches zero height, it does not need the measurement gating an earlier draft called for. The caret and scroll-spy margins still need clamping to a fraction of container height: at the 96px document floor, `SCROLL_MARGIN` of 100px top and bottom inverts the visible band.

Mode changes need no scroll-anchor mechanism. Shrinking the document scroller raises `scrollHeight − clientHeight`, so `scrollTop` stays valid and the top visible element does not move. Growing it clamps `scrollTop` to the new maximum, which lands the reader at the document's end — where they already were. Measured across `expanded → half → closed` at both a mid-document and an end position.

Message rows in the feed need `flex-shrink: 0`. A scrolling flex column shrinks its children instead of overflowing them; without it the prototype flattened media tiles to a quarter of their height.

There is no feature-flag mechanism in this webapp. This ships to every mobile chat user at once and rollback is a revert. Keep the prerequisite fixes in separate commits so they survive one: dropping `useAdjustEditorSizeForChatRoom` from `MobileEditor` (410px of dead scroll space today), scoping the keyboard gate to chat-owned focus, and deleting the inert `modalEffectThreshold`.
