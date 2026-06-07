# Summary

What's been shipped, grouped by area.

## Chat composer buttons (emoji, mention, format)

- Emoji and mention buttons show when active. Tapping one while the other is open closes the first and opens the new one (feature).
- Tapping the mention button again closes the picker. Before, it just added more `@` symbols.
- Tapping mention mid-word now adds a space before `@` so the picker opens (feature).
- Escape closes the emoji picker without affecting a reaction picker (feature).
- Format buttons on mobile (Bold, Code block, etc.) turn off when tapped again (UI).

## Right-click / long-press context menus

- Chat and table-of-contents menus now look and behave the same in light and dark mode (UI and consistency).
- Replaced broken-looking separators with thin straight dividers (UI).
- Mobile long-press uses the same menu style (UI).
- The "who has seen this message" row only shows its divider when the row is visible (UI).
- Merged duplicate desktop/mobile menu code into one shared list (code cleanup and consistency).

## Reply and comment quote bars

- Clicking or tabbing to the blue reply quote bar jumps back to the original message (feature).

## Mobile "user joined" card

- Card is wider with better vertical spacing. Removed the chat-bubble layout that was holding it back (enhancement).

## Mobile table of contents drawer

- Added a sticky bottom bar with filter, document settings, and bookmarks (bookmarks only when signed in) (feature).
- Top bar simplified to just history and close (UI).
- "Add heading" stays in the scrollable outline list, not the sticky bar.
- More spacing around the header, title row, and footer so icons clear the screen edge and iPhone home indicator (UI).

## Link popover (document + chat composer)

- Desktop popover is wider and grows more for long URLs (feature).
- URL field grows downward as you type or paste, up to about 4 lines, then scrolls inside (feature).
- Pasted URLs with line breaks or tabs get cleaned up automatically (feature).
- Enter saves the link. Pressing Enter with an empty URL no longer flashes a false error (feature).
- Screen readers still see it as one link field (accessibility).
- iOS autocorrect no longer mangles URLs (accessibility).
- Same field used in the chat composer's link dialog (consistency).
- Text and link icons are the same size on desktop and mobile (consistency).

## Mobile link sheets

- Add/edit link is a full sheet with a title at the top, scrollable fields, and Back/Apply pinned at the bottom (enhancement UI and UX).
- Link preview keeps Open, Copy, Edit, Remove as a list, with title/icon/URL lined up with the action rows (UI).
- Same title-header pattern across bookmarks, filters, document settings, and notifications (UI and consistency).
- Notifications keeps "Mark all read" in the header only (UI).
- Link preview block and suggestion list line up with the sheet padding (UI and UX).

## Mobile tab controls

- Active/Archived tabs on bookmarks and notifications now look like one control with a sliding highlight and small red count badges (UI and UX).
