# ✨ docs.plus demo

docs.plus is a free, open-source shared document with a chatroom per heading.

![docs.plus: a shared page with people writing and talking all over it](/demo-assets/d0-intro.png)

Every line below is a filter, not an anchor. Click one and the page folds to that section alone.

- [👋 Start here](/demo/running)
- [💬 A chatroom on every heading](/demo/notifications)
- [🗂️ The table of contents](/demo/lights)
- [🔍 Filter by word](/demo/filter%20by%20word)
- [🧱 Why a section behaves this way](/demo/behaves)
- [🔗 Links](/demo/mailto)
- [🎬 Media](/demo/soundcloud)
- [✍️ Writing](/demo/writing)
- [📊 Diagrams](/demo/pele)
- [📜 What the history holds](/demo/snapshot)
- [📤 Import and export](/demo/import%20and%20export)
- [🔐 Who can open this document](/demo/owner-only)
- [🚀 Make your own](/demo/make%20your%20own)
- [🆕 What's new](/demo/released)

# 👋 Start here

docs.plus is a shared document where **every heading has its own chatroom**.

**This page is docs.plus running**, not a picture of it. Try the things it describes as you read them.

Open the chatroom on this heading from the chat button on its table of contents row — try it here.

This document is **read-only**. [/new](/new) opens a blank document you can write in.

![Three headings, three chatrooms, one page](/demo-assets/d1-idea.png)
_The chatroom for a passage sits beside the passage, not at the bottom of the page._

Filtered to this section? [Show the whole document](/demo).

# 💬 A chatroom on every heading

Every heading carries its own chatroom. The talk about a passage sits beside the passage, not at the bottom of the page and not in another app.

A reply under a heading needs no quoted context. The passage is directly above it.

## One chatroom per heading

Messages posted under a heading **belong to that heading**. They show up nowhere else in the document. There is no general channel they fall into.

Open the chatroom on this heading, read it, and scroll back through it — try it here.

On desktop, move the pointer anywhere over a section, and its heading's chat button shows beside the heading. Click it to open that chatroom — try it here.

On desktop, drag the top edge of the docked chatroom down to close it. Let go below 160px and it closes. Let go between 160px and 320px and it returns to 320px — try it here.

A dated line separates the days. New messages, edits and reactions **arrive without a reload**.

A reply carries the message it answers: the author, the time, and a short run of it. Click that quoted block and the chatroom opens the message it came from — try it here.

Signed out, the composer opens the sign-in dialog instead of sending — needs an account.

![A heading, the passage under it, and the chatroom below](/demo-assets/d8-reply.png)
_A reply quotes the message, not the page. The page is already above it._

## Counts sit in the table of contents

In the table of contents, a heading with messages swaps the chat button's icon for a count.

Signed out, that number is **the chatroom's total message count**. It counts every message in the chatroom, not the ones that are new to you.

Signed in, the same badge becomes **your own unread count**. Scrolling through the chatroom clears it — needs an account.

## Comments point at a passage

A comment **carries the passage it is about**: an excerpt for text, a thumbnail for a picture or a video, framed in that media's colour.

Click the quoted block on a comment — try it here. The document scrolls to that exact run of text, not to the top of the section.

When the passage can no longer be found, the jump lands on the heading instead.

A comment starts in the document body. It posts into the chatroom of the heading that holds it — needs a document you can edit.

## Who is in the chatroom

On desktop, **a stack of faces sits on the table of contents row** of every heading whose chatroom someone has open. Hover a face for the name — try it here.

Signed in, a face also shows what that person is doing. A bouncing face means typing, a smile means choosing an emoji, and a mic means recording a voice note — needs an account.

A heading row shows up to four faces, then a count of the rest.

The stack **follows open chatrooms, not scroll position**. On a quiet document it stays empty.

Signed out, you see other people and they do not see you. Your own face joins a row once you sign in — needs an account.

![Table of contents rows carrying a chat count and a stack of faces](/demo-assets/d6-collab.png)
_A count means messages. A face means someone has that chatroom open._

## 🔓 Read-only locks the text, not the chatroom

The lock **stops at the document body**. Every chat control on this page still works. The chat button on each table of contents row opens its chatroom. The composer sends once you are signed in, and the message arrives for anyone who has that chatroom open.

The text is fixed. The talk is not.

The table of contents has no drag grip and no Delete section here, because a locked page refuses both. Both need a document you can edit.

Open the chatroom on this heading and say what you would use a per-heading chatroom for — needs an account.

## What a chatroom takes once you sign in

**Everything under this heading** needs an account. This heading has sub-headings, so its table of contents row carries a chevron. Fold the section from that chevron to put it away — try it here.

### Reactions

Each emoji on a message is a _chip_, and reading a chip takes no account.

A chip carries a number only when more than one person used that emoji. A single reaction shows the emoji alone.

On desktop, the smiley in the hover menu opens the full picker. On mobile, a long press offers eleven one-tap emoji, and a `+` for the rest — needs an account.

A reaction chip **is not a toggle**. On desktop, clicking a chip you are part of takes your own reaction back off, and it never adds one — needs an account.

![Reaction chips, the desktop picker, and the mobile quick row](/demo-assets/d11-react.png)
_One tap answers, and the chatroom stays short._

### Files and voice notes

A chatroom takes what the page takes: images, video, audio, PDF, text, CSV, Markdown, JSON, Word, Excel, PowerPoint and ZIP.

The caps are **10 MB per file, 10 files per message, and 3 uploads at a time**. A voice note runs to 5 minutes and draws 24 live bars from the microphone as it records — needs an account.

On a phone, hold the mic to record. Slide up to lock, slide left to cancel, and let go to send. A tap shows a hint and never sends — needs an account.

An audio clip in a chatroom plays with seek, at 1×, 1.5× or 2× speed. Starting one clip pauses the others. A voice note sent from 2.1.0 on shows a 40-bar waveform and its length before you press play. Post a voice note to hear one — needs an account.

Two to ten pictures in one message lay out as a single tiled block. Click a tile for the full-screen gallery, and download from there — try it here.

An image can be sent as a spoiler, blurred until the reader taps it. Video and audio cannot — needs an account.

![Attachment caps, a staged file, and a spoiler tile](/demo-assets/d12-attach.png)
_A chatroom takes what the page takes, inside a fixed set of caps._

### Keep a message for later

A bookmark saves a message to your own list, and a second tap takes it back off. The message keeps a Bookmarked tag in the chatroom — needs an account.

The list opens from the bookmark icon in the document toolbar, in three tabs: in progress, archive, and read. View on a row opens that heading's chatroom at the message — needs an account.

![A saved message, and the bookmark list beside it](/demo-assets/d9-bookmark.png)
_The message keeps a tag. The list keeps the message._

### Mentions

Type `@`, then pick a name, to tell that person about the message. `@everyone` tells the whole chatroom — needs an account.

A name you pick from the list reaches that person, even after they rename. A name you only type **must match the whole username**. `@harvey` does not reach `harvey_marzban`, and `@everyone_team` does not fire `@everyone`.

A mention in a message is coloured and tappable. Tap it for that person's profile card — try it here. On your own empty card, Add bio and links opens Settings on Profile.

![A mention that matches, and one that does not](/demo-assets/d15-mention.png)
_A typed name matches in full, or sends no alert._

### Alerts, and how loud they are

A bell in the document header holds the list: mentions, replies, reactions, thread messages, channel events, direct messages, invitations and system alerts. The bell is hidden until you sign in.

View on a row opens that heading's chatroom at the message, and Mark all read clears the list — needs an account.

![The alert list, with View on every row](/demo-assets/d13-notify.png)
_Tap View. Land on the message._

Every heading has its own chatroom, so **every heading has its own level**. One bell in the chatroom header cycles All notifications, then Mentions only, then Muted. There is no menu — needs an account.

![One bell cycling three levels across three headings](/demo-assets/d14-level.png)
_Mute one section and keep the next one loud._

## Move a message into the page

Copy to doc **writes the message into the document**, under the heading that owns the chatroom. The line it leaves is dated and links back to the message. The message's files come with it — needs a document you can edit.

Reply in thread does the other half. It **turns a message into a new heading** in the document, then opens that heading's chatroom — needs a document you can edit.

Both controls stay visible on this page, and the server refuses both writes.

Copy link on a message works here. It puts a link to that message on your clipboard, and its icon turns into a check — try it here.

![A message in the chatroom, and the dated line it leaves in the page](/demo-assets/d10-copytodoc.png)
_Say it in the chatroom, keep it in the page._

Filtered to this section? [Show the whole document](/demo).

# 🗂️ The table of contents

Every heading in this document **gets a row in the table of contents**, at its own level, in document order. Scroll the page, and the row you are reading lights up. The table of contents scrolls itself, so that row stays in view. Click a row and the page scrolls to that heading — try it here.

![The table of contents beside the page, one row per heading, with a folded section drawn as strips](/demo-assets/d2-outline.png)
_One row per heading. Fold from a row, and the page creases where the text went._

## What lands in a row

A row carries the level of the heading and the text you typed. A heading with no text still **gets a row**. The row shows the page's grey hint, such as "Heading 2" — needs a document you can edit. So the table of contents always matches the page.

The table of contents has its own column. Drag the divider between that column and the page to resize it — try it here. The width runs from 240px to 46% of the column and page together. Your browser remembers a width above 240px. That gesture needs a mouse.

Drag the divider below 120px, and the column turns into the **tick rail**: a 32px strip with one tick per heading. The docked chatroom then spans the full width — try it here. Hover or focus a tick to open its section card, and click the tick to jump there. The button at the top of the rail, or a reload, brings the full table back.

The section card has a chat button that opens that heading's chatroom. Tab moves into the card, and Escape leaves it — try it here. A video or an embed never plays in the card.

## The row's menu

**Right-click a row for its menu** — try it here. This page shows four entries. Chat room opens the chatroom on that heading. Fold section folds it, and on a folded row it reads Unfold section. Focus section writes the heading text into the address as the only filter term. Copy link puts a link to that heading on your clipboard, and the copied link scrolls there on a cold page load.

Paste the copied link into a rich text editor, and its text names the heading and the headings above it, like a breadcrumb. It never carries the filter or the chatroom you have open — try it here.

On a focused row, `Shift+F10` or the Menu key opens the same menu — try it here.

A document you can edit adds a fifth entry, Delete section. It removes the whole section, body text and media with it. It asks you to confirm first.

The menu is desktop only. The document title row at the top has none.

## Folding

The chevron on a row folds its section — try it here. Body text, media and sub-headings hide, and **the page creases where they were**. The crease is sized by what it covers: two strips for a short section, up to four for a long one. Click a crease in the page to unfold it — try it here.

The chevron appears **only on a heading that has sub-headings**. A heading with body text alone folds from its right-click menu. `📜 What the history holds` is one of those — try it here.

A fold changes no text. It is **drawing, not editing**, which is why it works on this locked page. Your folds are kept per document, in your own browser. Reload, and the page comes back creased where you left it. Nobody else sees them.

A filter folds sections for you. It saves your own folds first, and puts them back when you clear the filter.

A link to a heading lands on it, even when a fold or a filter hides it. It opens only the sections that hide the heading, then scrolls the heading to the top. Those sections stay open for this visit only. Your saved folds do not change, so a reload folds them again.

## Moving a section

Drag the grip on a row up or down, and let go between two rows — needs a document you can edit. The slot sets the level: the section joins the list where the line sits, and the rail of the list it joins turns blue. Let go on the middle of a row instead, and the section goes inside that row, as its last sub-section. Let go where it started, and nothing changes. The first line, the title, has no grip, and nothing can land above it.

![A drag card over the table of contents, with the landing line and the rest of the section stacked behind it](/demo-assets/d7-drag.png)
_The slot sets the order and the level. The whole section travels._

**The whole section travels**: the heading, its body text, its media, and every sub-heading under it. One undo step puts it back. Every sub-heading shifts by the same number of levels as the dragged heading, and stops at H6. A move never pulls the headings that follow into the section.

A cut and paste inside the same page keeps each heading's chatroom and every link to it — needs a document you can edit. A paste from another page or another site gives the headings new ids, so they start new chatrooms.

The grip is desktop only.

Filtered to this section? [Show the whole document](/demo).

# 🔍 Filter by word

The path after the document name is the filter. Nothing else holds that state.

Open [/demo/spotify](/demo/spotify). The page folds down to the two sections that hold the word, and every hit is marked where it sits — try it here.

![An address field holding two filter terms, beside a page folded down to the sections that match](/demo-assets/d3-filter.png)
_The path after the document name is the filter. Every hit is marked where it sits._

A section stays open when the word appears in its own text: the heading, plus the body under it, down to the next heading. Its parents stay open with it, and so does everything nested beneath it.

The match is a plain run of letters, and it ignores case. So `fold` also finds `folding` and `unfold`. A run of spaces, tabs or hyphens counts as one gap, so `customer-research` finds `customer research`.

Two things follow. A term that matches a heading always keeps that section, so every section name on this page works as a filter. And **the filter reads text, not subject matter**.

One of the two sections `spotify` keeps is `▶️ Embeds`. The other is this one, because the word sits here too.

**Every word in this document** is a filter term. Try [/demo/account](/demo/account) next. It keeps every claim that needs one, and this section again.

You do not have to use the links above. The **filter button in the toolbar** opens a search box that counts the matching sections as you type — try it here. Type any word on this page and watch the rest fold away. Whatever you type becomes the address, so you can hand that view to someone else.

## Either word, or both

[/demo/fold/drag](/demo/fold/drag) keeps a section that holds either word. `?mode=or` is the default, so naming it changes nothing.

[/demo/fold/drag?mode=and](/demo/fold/drag?mode=and) **demands both words in one section**. Its result is always a subset of the other, because an intersection cannot return more.

Two sections hold both words: this one, and `A section is a range`. Their parent headings stay open above them.

## The URL is the state

Active terms sit beside the title as chips. Each chip carries an × that drops that one term — try it here. Reset sits beside the chips, and clears every term and the mode with it. On desktop it fades in when you hover the row.

Copy what is in the address bar, and you have handed someone **the view itself, not a description of it**.

## Find, without folding

On desktop, press `⌘+F` or `Ctrl+F`. The **Find bar** opens at the top right of the page — try it here.

It counts the matches, such as 3 of 12. Previous, Next, `⌘+G`, `⇧+⌘+G` and `F3` step through them. `Escape` closes the bar.

The filter folds away what does not match. Find keeps the whole page and steps through it. A match inside a folded section opens that section, then folds it again when you move on.

On a phone, Find is a docked row, and the table of contents drawer offers it too.

Press `⌘+⇧+K` or `Ctrl+Shift+K` for the jump list — try it here. On this page it offers History, Filter, Find in document, New document and Demo. Type to narrow the list. Your Settings, alerts and documents join it once you sign in — needs an account.

Filtered to this section? [Show the whole document](/demo).

# 🧱 Why a section behaves this way

Every heading opens a section. Folding, the table of contents, the filter, and the chatroom on a heading **all key off that one fact**.

## A section is a range

A section is not a container you put text into. It is a _range_ the editor computes. It runs **from a heading to the next heading at the same level or above it**. When there is none, it runs to the end of the document.

Underneath, **the document stays flat**: one list of blocks, with nothing nested inside anything.

![A flat numbered list of blocks, with two computed ranges marked beside it](/demo-assets/d5-ranges.png)
_A section is a span the editor computes over one flat list of blocks._

That range is the unit the rest of the product acts on. The table of contents row stands for it. A fold hides it. A filter keeps it or drops it. A drag carries it.

## 📐 Size comes from rank

Heading size is **computed, not chosen**. Nothing in the markup says 18pt.

1. Take the headings from one `#` to the next `#`. The document title takes no rank.
2. Collect the distinct levels among them, in order.
3. Give the first 24pt, the last 14pt, and space the rest evenly between.

| Distinct levels | Sizes, in points            | Step between ranks |
| --------------- | --------------------------- | ------------------ |
| 1               | 24                          | —                  |
| 2               | 24 · 14                     | 10                 |
| 3               | 24 · 19 · 14                | 5                  |
| 4               | 24 · 20.67 · 17.33 · 14     | 3.33               |
| 5               | 24 · 21.5 · 19 · 16.5 · 14  | 2.5                |
| 6               | 24 · 22 · 20 · 18 · 16 · 14 | 2                  |

The block that holds this heading is the proof. It starts at `🧱 Why a section behaves this way` and ends at the next `#`. That block uses two levels, so its sizes are 24pt and 14pt. This heading is a `##`, so it renders 14pt.

Now take the block that starts at `💬 A chatroom on every heading`. It uses three levels, so a `##` inside it renders 19pt. Same tag, different size, because **size answers how deep a heading sits inside its own block**.

Filtered to this section? [Show the whole document](/demo).

# 🔗 Links

Click a link on this page and a card opens under it, naming what sits on the other end — try it here. Going there takes a second click, on the card. You see where a link leads **before you commit to leaving**.

## An icon on every link

Most links on this page start with a small icon that shows where they go — try it here.

A web link shows its site's favicon. A link to another docs.plus page shows the docs.plus logo. A mail or phone link shows a mail or phone icon. This page holds none.

A link into this page shows what it opens: a heading, a chat, a filter, a version or the top. So every line of the contents list at the top carries the filter icon.

The icons come through our own server, never straight from the linked site. A site with no icon keeps a plain link. In print, a link shows no icon.

## Rest on a link

On desktop, rest the mouse on a link and a card opens after half a second, with no click — try it here. The card asks for its content only after 150 ms, so a pointer that passes over a link costs nothing. Our server fetches the card, so your browser sends nothing to the linked site.

A slow page opens the card with grey bars, and the content then replaces them in the same card. After 4 seconds with no answer, the card shows the address and says the site shares no preview.

The last line of the card holds **Copy link** and **Open in new tab**. When a link's text is its own address, the line also offers **Use page title** — needs a document you can edit. Move off the link and the card, and it closes 300 ms later. Shift, the arrow keys and Copy keep it open. Any other key closes it.

Settings › Appearance › **Show link previews on hover** turns the cards off — needs an account. A touch screen has no hover, so a tap opens the click card instead.

## Out to the web

[https://github.com/docs-plus/docs.plus](https://github.com/docs-plus/docs.plus) is an ordinary external link. Rest on it, and its card shows the page's picture, title and description — try it here. Some public GitHub projects add **the stars, the main language and the last update**, as [ueberdosis/tiptap](https://github.com/ueberdosis/tiptap) shows — try it here. Click a link, and its card fills with **the page title and the site icon, held for 5 minutes**. Copy link sits on the card, and its icon turns into a check when the copy works — try it here. On desktop, Edit and Remove sit there too, but only on a document you can edit.

The card's title is itself a link, so one click on the title goes there — try it here. When the fetch fails, that title falls back to the raw address, and the link still works.

Middle-click a link, or hold ⌘ (Ctrl) and click it, to skip the card and open it in a new tab — try it here. On a document you can edit, a link shows the hand cursor only while you hold ⌘ or Ctrl. On this page, links always show it. Press Enter on a focused link to open its card, even on this page.

With the caret inside a link, ⌘+K (Ctrl+K) opens its card, and Alt+Enter opens the link — needs a document you can edit.

A Stack Overflow question shows its answer count. It adds **Accepted answer** when one is accepted: [Why is conditional processing of a sorted array faster than of an unsorted array?](https://stackoverflow.com/questions/11227809/why-is-processing-a-sorted-array-faster-than-processing-an-unsorted-array) — try it here. A Wikipedia article shows its opening lines, and its lead picture when it has one: [Collaborative real-time editor](https://en.wikipedia.org/wiki/Collaborative_real-time_editor) — try it here. A job post shows where the job is, how it is worked, and when it was posted.

## When a page shares nothing

Some sites refuse to share a preview. Then the card puts the address first: the site name is the title, and the full path wraps under it. The last line says why there is no preview. [The New York Times](https://www.nytimes.com/) does not share previews — try it here. When the site blocked us or did not answer, the card also offers **View archived copy**. One click asks the Internet Archive for a saved copy, then shows a link that opens it.

A link to a file gets its own card, with the file name as the title: [a sample PDF](https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf) says it is a PDF file — try it here. The card knows PDFs, documents, spreadsheets, slides, archives, pictures, audio and video.

When a link's text names one site but the link opens another, the card warns you. This link reads [github.com](https://github-login.example.net/session) but opens another site — try it here.

On mobile the card is a bottom sheet instead. Its four rows are Open link, Copy link, Edit link and Remove link. The first two work with no sign-in — try it here.

## Paste a link, get its name

Copy a web address, paste it into a document, and the link takes **the page's title** in place of the long address — needs a document you can edit. The address shows at once, and the title replaces it when our server answers, usually within a second. Paste [https://github.com/docs-plus/docs.plus](https://github.com/docs-plus/docs.plus) into a page from [/new](/new) to see it.

One undo brings the address back, and a second removes the paste. ⌘+⇧+V (Ctrl+Shift+V) pastes the address as it is. A file link takes its file name and format, so the sample PDF above reads `dummy.pdf`. A link to another docs.plus page takes that page's title, and a heading link reads like `Budget · Q3 launch plan`. A link to a Private page keeps its address, and so does a link pasted in a chatroom.

A title can never pose as another site. A page titled `paypal.com` that lives anywhere else keeps its address.

Settings › Appearance › **Use page titles for pasted links** turns it off, and **Use pad titles for pasted pad links** does the same for docs.plus links — needs an account.

## Built on an open extension

The hover cards and the pasted titles both come from our open-source Tiptap extension, [@docs.plus/extension-hyperlink](https://github.com/docs-plus/docs.plus/tree/main/extensions/extension-hyperlink). Any Tiptap editor can use them, and both stay off until a developer turns them on.

- `hovercard` takes your own preview service. It brings the timing, the keys and the card frame, and you can draw your own card inside it. Guide: [Hovercard](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/docs/hovercard.md).
- `pasteTitle` takes your own title service. It brings the undo step, the raw paste and the title cleaning. Guide: [Paste title](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/docs/paste-title.md).

Both ship in the next npm release of the extension.

## Addresses that are not web pages

A `mailto:` or `tel:` link has no page to fetch. The address becomes the title, and the icon names the kind. The pad maps **47 schemes** this way: mail, phone, maps, video calls, and app links.

## Back into the document

A link into this document never touches the network. It resolves on the spot, and its click card shows a destination chip. The chip names the place: **This document**, a quoted heading, a chat or a message, **Filtered view**, or **Version N**.

[/demo/crease](/demo/crease) is such a link. Its card carries a **Filtered view** chip, with **Match any** and one pill for each term. Click the chip and the page folds in place — try it here. No reload, and no new tab.

A [/new](/new) link gets a chip of its own, **New document**. Click the chip, and a blank document opens in a new tab.

## Cards for docs.plus pages

Rest on a link to a docs.plus page, and its card comes from the page itself, not from a scraped preview. It names the page, the headings above the target, and what sits there. A filter or a heading in this page reads the open page, so it asks the server nothing.

[/demo/crease](/demo/crease) shows **Filter for “crease”**, how many sections the filter shows, and the first two. Every filter link on this page has a card like it — try it here.

[Folding](/demo?id=HoKBe56adb5466L6) shows the heading, the headings above it, its subsections and its first lines — try it here. Fold `🗂️ The table of contents` first, then click the Folding link and its chip. The page opens that fold and lands on the heading — try it here.

[The chatroom on Start here](/demo?chatroom=6adb5466z7HG78l0) shows how many messages it holds — try it here. A card shows counts and dates only, never a message or a name.

[This page's history](/demo#history) shows how many versions the page keeps, and the last save. [Version 1](/demo#history?version=1) shows when that version was saved — try it here.

A link to a Private page shows only **This document is private**. Its title and text stay hidden from everyone but its owner.

Filtered to this section? [Show the whole document](/demo).

# 🎬 Media

**Nine kinds of media** sit in the body text: pictures, uploaded video, uploaded audio, and six embed providers.

## Images

A picture sits **in the run of the text**, not in a gallery beside it. While a remote picture loads, a grey shell holds its place. A picture that fails to load says so, and names the site it comes from.

Hover a picture and its toolbar appears — needs a document you can edit. The toolbar checks edit rights first, so this page shows the pictures and no toolbar.

Eight handles ring the picture with that toolbar up. The four side handles change one axis. The four corner handles change both and always keep the shape — needs a document you can edit. Nothing goes below 160px wide or 80px high.

## Video and audio

An uploaded file plays where it sits. Press play on the video and then on the audio below it — try it here.

Neither is built by pasting an address, the way the embeds are. Both arrive through the insert panel — needs a document you can edit. A file uploaded there can be up to 10,485,760 bytes, and the upload needs an account.

[/demo-assets/demo-video.mp4](/demo-assets/demo-video.mp4)

[/demo-assets/demo-audio.mp3](/demo-assets/demo-audio.mp3)

_Clip credits: the video is Big Buck Bunny, © Blender Foundation, CC BY 3.0. The audio is Example.ogg from Wikimedia Commons, CC BY-SA 3.0._

## ▶️ Embeds

Six providers **render in place rather than as links**: YouTube, Vimeo, Loom, SoundCloud, Spotify, and X. Paste a provider address into the body and the player is built on the spot — needs a document you can edit. No menu, and no dialog.

An X post has no drag grip. Its width comes from presets instead — needs a document you can edit.

A Spotify player will not go under its own height. A single track floors at 152px, and every other kind floors at 352px.

<https://www.youtube.com/watch?v=aqz-KE-bpKQ>

<https://vimeo.com/76979871>

<https://www.loom.com/share/e5b8c04bca094dd8a5507925ab887002>

<https://soundcloud.com/forss/flickermood>

<https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl>

<https://x.com/jack/status/20>

Filtered to this section? [Show the whole document](/demo).

# ✍️ Writing

Formatting shows a reader which decisions matter.

Type `/` on an empty line for a list of blocks to insert, from headings to pictures — needs a document you can edit. Try it in [/new](/new).

## Marks that mean something

Reach for a mark when it changes meaning, not when a sentence feels flat. **Bold names the one thing a skimming reader must not miss.** _Italic marks a term or a title._ ~~Strikethrough keeps the record when a decision moves.~~ ==Highlight is a note to self: a section still wearing one is still owed work.==

![Four marks, each on its own line](/demo-assets/d4-marks.png)
_Bold, italic, strikethrough, highlight: four marks, four jobs._

Each mark has a toolbar button and a key, from `⌘+B` for bold to `⌘+⇧+H` for highlight — needs a document you can edit. Highlight also survives Markdown, as `==text==`. Clear formatting, or `⌘+\`, takes the marks off and keeps headings and links — needs a document you can edit.

There is a fifth mark, underline, and it is the one to reach for least. On a page full of links, an underlined word claims to be one.

## Code stays code

Inline code sets **a flag, a path, or a value** apart from the prose: `--frozen-lockfile`, `mode=and`, `heading-scale.ts`. Type a backtick pair, or press `Mod-e` — needs a document you can edit.

For anything longer than a phrase, use a fenced block and name the language. The pad colours **exactly nine**: `html`, `css`, `js`, `ts`, `markdown`, `python`, `yaml`, `json`, and `bash`. Name a block `mermaid` and the pad draws it instead — see [📊 Diagrams](/demo/pele).

```bash
bun run --filter @docs.plus/webapp dev
```

Filtered to this section? [Show the whole document](/demo).

## Lists, quotes and rules

Three kinds of list, and the choice carries meaning. Pick the one that matches the thing.

A **bullet list** holds items with no order. Reordering it changes nothing.

- A heading opens a section
- A section is a range
- A range is what folds

A **numbered list** holds steps that run in order. Reordering it breaks the instructions.

1. Open a heading from its table of contents row
2. Read what is under it
3. Answer in the chatroom beside it

A **checkbox list** tracks work that is not finished. A tick is saved for everyone reading — needs a document you can edit.

- [ ] Seed the chatrooms with a real conversation
- [ ] Draw the version history picture
- [x] Put every illustration in the page

A **quote** sets words apart from your own.

> A section is not a container you put text into. It is a range the editor computes.

Type three dashes and the editor draws a rule across the page — needs a document you can edit.

---

A rule ends a passage. It carries no text, so a filter never keeps a section for it.

# 📊 Diagrams

Write a diagram as text, and docs.plus draws it under the text. **Every diagram below is drawn live in your browser**, not pasted as a picture.

![Diagram text above, the drawn diagram below it](/demo-assets/d17-diagrams.png)
_The text is the diagram. Change a word and the picture follows._

The text is Mermaid, the diagram language GitHub and Obsidian read. Pele draws it, the small Mermaid renderer by Steph Ango, CEO of Obsidian. Flowcharts, sequences, states, timelines, pie charts and more all work.

Type `/diagram` on an empty line, or pick Diagram from the Code menu, and you get a small example to change — needs a document you can edit. Try it in [/new](/new).

On this read-only page each diagram starts with its text folded away. Hover a diagram for three buttons: **Syntax** opens the Mermaid reference, **Copy** copies the text, and **Show source** opens it — try it here. Your choice is yours alone, and this browser remembers it.

Each diagram below sits under its own heading, so each one has its own chatroom — try it here.

## How a heading becomes a room

```mermaid
flowchart LR
  H["# A heading"] --> T["Table of contents row"]
  H --> C["Its own chatroom"]
  H --> F["A fold"]
  H --> L["A link to it, ?id="]
  H --> W["A filter by word"]
  C --> M["Comments, mentions, alerts"]
  T --> U["Unread count"]
  C -.-> U
```

One heading gives you five things at once. The rest of this page shows each of them.

## Two people, one page

```mermaid
sequenceDiagram
  autonumber
  actor Ana
  participant S as docs.plus
  actor Ben
  participant H as History
  Ana->>S: Types a sentence
  S-->>Ben: The same sentence, live
  Ben->>S: Answers in the chatroom
  S-->>Ana: The answer, beside the passage
  Note over S: Waits for 10 s of quiet, never more than 60 s
  S->>H: Saves a version
  Note over Ben,H: Ben can compare any two versions, and restore one
```

Edits reach everyone at once. History keeps a version after 10 seconds of quiet, and never waits more than 60.

## A document's life

```mermaid
stateDiagram-v2
  state "Read-only" as ReadOnly
  [*] --> Draft: open /new
  Draft --> Saved: first edit
  state Saved {
    Open --> Private: owner turns on Private
    Private --> Open: owner turns it off
    Open --> ReadOnly: owner turns on Read-only
    ReadOnly --> Open: owner turns it off
    ReadOnly --> Private: Private clears Read-only
  }
  Saved --> Trash: owner deletes it
  Trash --> Saved: restore within 30 days
  Trash --> [*]: purged after 30 days
```

Private and Read-only belong to the owner, and only one is on at a time. Trash keeps a document for 30 days.

## From Etherpad fork to diagrams

```mermaid
timeline
  title docs.plus, release by release
  2022 : 1.8.18, the last Etherpad fork
  August 2026 : 2.0.0 : A chatroom on every heading : Version history and restore
  October 2026 : 2.1.0 : AI apps in your documents : Change digest email : Find bar and QR code
  22 October 2026 : 2.2.0 : Diagrams drawn in the page : More AI apps, one page to start
```

## 2.1.0 in one picture

```mermaid
pie showData
  title 136 issues closed in 2.1.0
  "Bugs" : 71
  "Security fixes" : 33
  "Other changes" : 32
```

## Measured on real phones

How big may a diagram be before it slows a phone down? We did not guess. We drew test diagrams of each size 50 times on a real Android phone and a real iPhone. That was on 21 October 2026, with Pele 1.7.0. For each size, we kept the slowest draw of the slowest test diagram. Our budget is **200 ms**, the orange line. Every bar above it failed.

```mermaid
xychart-beta
  title "Android phone: slowest draw of a test diagram"
  x-axis "Diagram size, in characters" ["5,000", "10,000", "15,000", "20,000"]
  y-axis "Milliseconds (slowest of 50 draws)" 0 --> 2000
  bar [105, 176, 1097, 1946]
  line [200, 200, 200, 200]
```

At 10,000 characters the phone stays under budget. At 15,000 the slowest draw took **1.1 seconds**, more than five times the budget. So a diagram stops at 10,000 characters.

```mermaid
xychart-beta
  title "The slower phone: milliseconds to draw a flowchart"
  x-axis "Arrows in the flowchart" ["250", "500", "750", "1,000"]
  y-axis "Milliseconds (slowest of 50 draws)" 0 --> 2000
  bar [119, 229, 328, 1937]
  line [200, 200, 200, 200]
```

Arrows cost more than text. Both phones went over budget at 500 arrows, so a diagram stops at 250.

| Size              | Mac   | iPhone     | Android      |
| ----------------- | ----- | ---------- | ------------ |
| 10,000 characters | 25 ms | 94 ms      | 176 ms       |
| 15,000 characters | 37 ms | 132 ms     | **1,097 ms** |
| 250 arrows        | 21 ms | 119 ms     | 119 ms       |
| 500 arrows        | 37 ms | **229 ms** | **202 ms**   |

A Mac drew even a 20,000-character diagram in 51 ms. The phone in your pocket is the real test. These two charts are drawn live by Pele too, from six lines of text each.

## When a diagram goes wrong

A mistake shows one second after you stop typing, with the line it is on. The last good drawing stays on screen, faded, so the page never jumps — needs a document you can edit.

A diagram over **10,000 characters or 250 arrows** is not drawn, so a big one never freezes a phone. We measured that limit on a real iPhone and a real Android phone. The message names the limit it hit and the count, and asks you to split it.

A connected AI app can write diagrams too. docs.plus checks each one before the write, and refuses one that does not parse or is too large — needs an account.

History, print and dark mode all show the drawn diagram. Markdown export keeps the text as a `mermaid` block, so a diagram survives the trip out and back.

Filtered to this section? [Show the whole document](/demo).

# 📜 What the history holds

Every save is **a whole snapshot of the document**, with a rising version number. Typing is saved after 10 seconds of quiet, and forced after 60 seconds when you keep going.

Open the history from the clock button in the document header. A public document does not need an account to read it.

Versions arrive grouped into _sessions_, then into days titled Today, Yesterday, or a date. A session breaks after a gap of two minutes. A row carries the faces of the people in that version. It also carries a badge naming where the version came from: API, Checkpoint, Restored, Pre-restore, Migration, or Connected app. Connected app marks a version that an AI app wrote. An ordinary live save gets no badge.

The list shows the newest 50 versions. When a document has more, Show older versions loads the next 50.

Click a version and it renders in a read-only editor, so **reading an old draft changes nothing**. Heading chat is hidden while you read one. Inside the view you can compare two versions, copy a link to one, and print the one you are reading.

Compare marks what was added inline, and keeps what was removed as struck-through text. A change to formatting only, such as bold or a heading level, gets an edge on its block. The authors panel colours each block by whose text sits there now.

**Restore puts an old version back for everybody.** It is offered only to a signed-in writer, and only on a version that is not the latest. A visitor never sees the control. A restore writes a safety copy of the current text first, and that copy carries the Pre-restore badge.

After 30 days, old automatic saves are thinned to one per day. Each day's newest save survives. A version you named yourself is never thinned.

The history can name who wrote a run of text. It can **never name who deleted one**. A restore, an import, or an API write carries no author, so the badge names the operation instead.

A signed-in rename of the Pad title posts a notice in the document chat. History paints the latest of those notices above the editor. That notice is not a version. A signed-out rename posts nothing.

Signed in, you follow a document when you open it. Turn on email in Settings, and edits by other people arrive as a change digest email. It marks added and removed words under each changed heading — needs an account.

Turn Follow off in Document settings to stop that mail. In the alert list, View on a document change opens History with compare already open — needs an account.

Filtered to this section? [Show the whole document](/demo).

![Saved versions grouped by day, with faces, badges, and no Restore on the newest](/demo-assets/d16-history.png)

# 📤 Import and export

The gear button opens Document settings. Its Import & export section holds four export rows: Word `.docx`, Markdown `.md`, OpenDocument `.odt`, and Print / Save as PDF. **Print / Save as PDF works with no account** — try it here. Word, Markdown and OpenDocument ask you to sign in first — needs an account. Signed in, an export opens your browser's save picker where it has one, or the share sheet on iOS.

An export is built from the last saved version, so a very recent edit may be missing from it.

Import takes `.docx` and `.md` only, up to 10,485,760 bytes, and Markdown stops at 65,536 characters. It replaces the whole document — needs an account and a document you can edit. A heading keeps its chatroom when its text stays the same, even at a new level. A renamed heading keeps it too, when its section text is unique and unchanged. Before the replace, the confirm card names each heading whose chatroom holds messages and would lose them. History keeps the earlier version, so a restore can bring it back. On this read-only page, Replace with a file says the document cannot be replaced — try it here. A Markdown replace keeps pictures at their natural size, and a lone video, audio, or embed URL becomes a player.

A Markdown export keeps the caption, size and placement of every picture, video, audio and embed. A Markdown import reads them back, and so does an AI app that writes Markdown — needs an account. The guide is [Media in Markdown](https://github.com/docs-plus/docs.plus/blob/main/docs/media-in-markdown.md).

A Word import accepts every tracked change, and says so — needs an account and a document you can edit.

Filtered to this section? [Show the whole document](/demo).

# 🔐 Who can open this document

A document carries **two flags: Private and Read-only**. Private is owner-only. A signed-out visitor is asked to sign in, and any other signed-in person is refused. Read-only stops everyone but the owner from editing, and this page is read-only.

A document with no owner is open. Anyone may change its Pad title, signed in or not. A signed-in person who first clicks into, types in or opens chat in a new document becomes its owner. Typing in a document that already exists never makes you its owner. Private and Read-only do not turn on until the document has an owner. This page already has an owner, so only they can rename it.

The two flags are never on together. Turning Private on clears Read-only in the same request.

The header shows a chip for each flag. Open Document settings from the gear button to see the owner, and the two flags as badges — try it here. Only the owner sees them as switches.

Share sits in the header, signed in or not — try it here. The Share card shares **the whole document**, never the heading or filter you are on. To share a filtered view, copy the address bar.

The Share card also shows a QR code. Scan it with a phone to open this page, or click it for a full-screen Present view — try it here. A button next to Close switches Present to a dark background.

The access line here reads Anyone with the link can view. Only the owner sees Change beside it.

On desktop, the Document QR code button after Filter shows the code in a QR card at the top right. Drag the QR card's corner to size the code from 128px to 1024px — try it here. A reload hides the QR card.

A share link **carries no permission**. There is no token, no expiry, and no grant to one person. Who can open a document is decided by the two flags, and by who you are signed in as. On a private document the Share card hides the link and the QR code, and says to turn Private off in Settings.

## A card when you share this page

Paste this page's address into a chat app or a social site — try it here. It shows a docs.plus card with the page's name and its first paragraph.

Our server draws the card from the saved page. A card never shows a person's name, a face or a chat message, and a Private page never gets one. A link to a heading, a chat or a version shows the same card as the page. A page with no owner shows the docs.plus home card.

Filtered to this section? [Show the whole document](/demo).

# 🚀 Make your own

[/new](/new) gives you a blank document with a random name, and you can write in it — try it here. Click the link, then the **New document** chip on its card. **Nothing to install**, and no sign-up to start.

Everything above then runs the other way round. You can type, move a section, and insert media from its address. Uploading a file, replacing the whole document with a file, and posting in a chatroom ask you to sign in first — needs an account.

Signed in, you can connect an AI app, such as Claude or ChatGPT. A connected app can read this page and its chat. It edits only documents you own, so it cannot change this one — needs an account.

Your Documents list in Settings shows the documents you own and the ones you joined. Favorite a document you own to keep it at the top, and sort by Last opened — needs an account.

The code is open: [https://github.com/docs-plus/docs.plus](https://github.com/docs-plus/docs.plus).

Filtered to this section? [Show the whole document](/demo).

# 🆕 What's new

The newest release comes first. Most parts end with a filter link to the place on this page that shows it.

## docs.plus 2.3.0

Released on OWED-RELEASE-DATE.

This release is about links. You see where a link goes before you click it, and a link you share shows what it holds.

### See where a link goes before you click

On desktop, you can now rest the mouse on a web link. A card opens with the page's picture, site, title and description — try it here. Our server fetches it, so your browser sends nothing to the linked site.

When a site shares no preview, the card says why. It warns you when a link's text names one site but opens another. A link to a docs.plus page gets a card made from the page itself — try it here.

On this page: [/demo/rest-on-a-link](/demo/rest-on-a-link).

### Every link shows its site

A small icon now sits before a link: the site's favicon, the docs.plus logo, or a mail or phone icon — try it here. A site with no icon keeps a plain link.

A link into this page shows what it opens: a heading, a chat, a filter, a version or the top. Its card names the place, such as **Filtered view** with one pill for each term.

On this page: [/demo/favicon](/demo/favicon).

### Pasted links take the page title

Paste a web address on its own, and the link now shows the page's title. A link to another docs.plus page takes that page's title. One undo brings the address back — needs a document you can edit. Try it in [/new](/new).

On this page: [/demo/paste-a-link](/demo/paste-a-link).

### A shared link shows what it holds

Paste this page's address into a chat app or a social site — try it here. It now shows a docs.plus card with the page's name and its first paragraph. A card never shows a person's name, a face or a chat message.

On this page: [/demo/social](/demo/social).

### Copied links read like a breadcrumb

Copy link on a table of contents row now gives a link that names the heading and the headings above it — try it here. It never carries the filter or the chatroom you have open.

A link to a heading now opens the fold that hides it. A link copied from History opens History at that version — try it here.

On this page: [/demo/breadcrumb](/demo/breadcrumb).

### Captions that survive Markdown

A picture, video, audio or embed now keeps its caption, size and placement through Markdown. A Markdown export, a Markdown import and an AI app that writes Markdown all keep them — needs an account.

On this page: [/demo/caption](/demo/caption).

### Move a section with its chatroom

On desktop, the slot where you let go of a table of contents row sets the section's level. A drop on the middle of a row puts the section inside it. A cut and paste inside one page now keeps each heading's chatroom and every link to it. All three need a document you can edit.

On this page: [/demo/cut-and-paste](/demo/cut-and-paste).

### The tick rail's section card

On desktop, the tick rail's section card now has a chat button for that heading. Tab moves into the card, and Escape leaves it — try it here.

On this page: [/demo/tick-rail](/demo/tick-rail).

### Things that work again

Folded sections open again. Before, a click on a folded section or on its arrow in the table of contents did nothing — try it here.

The email for a chat message now opens the document at that message. On Android, the slash menu and the link editor now keep the on-screen keyboard open — needs a document you can edit.

A pasted picture no longer vanishes when its address has no file extension. A picture that fails to load now names the site it comes from.

Sign-in no longer stops when Chrome wrongly says you are offline — needs an account.

### Safer links, safer server

A crafted web page can no longer stall our server while the server builds its link preview. Error reports no longer carry the address of a link you preview.

An erased account can no longer write back its profile, its preferences or its devices for push alerts.

### Faster and lighter

A large document now opens faster, and its offline copy no longer grows on every load.

We measured the link icons on a 2,000-link test page against the same page with no icons. In a local dev build, the icons added about 26 ms to the frame that fills the page. The frame took 134.3 ms with the icons and 108.5 ms without, each the median of 5 runs. We ran it in Chromium 156 on an Apple M5 Max laptop ([#516](https://github.com/docs-plus/docs.plus/issues/516)).

The server now reads a large document's last saved version much faster. On a 5.36 MB document, the read fell from 165.13 ms to 2.87 ms on an Apple M5 Max laptop. We did not time production ([#198](https://github.com/docs-plus/docs.plus/issues/198)).

Read every change in the [GitHub Release](https://github.com/docs-plus/docs.plus/releases/tag/v2.3.0) and the [CHANGELOG](https://github.com/docs-plus/docs.plus/blob/main/CHANGELOG.md).

## docs.plus 2.2.0

![docs.plus 2.2.0: Mermaid diagrams drawn live in an open-source collaborative editor, with a new Tiptap extension](/demo-assets/release-2.2.0-banner.png)

Released on 22 October 2026.

### Draw a diagram with text

You can now write a `mermaid` code block, and docs.plus draws the diagram under it, in the pad and in History. Flowcharts, sequences, states, timelines, pie charts and 28 more types all work.

Hide source folds the text away, so readers see only the picture. This read-only page starts folded — try it here. Type `/diagram` on an empty line to insert one — needs a document you can edit.

On this page: [/demo/diagram](/demo/diagram).

### Limits measured on real phones

A diagram over 10,000 characters or 250 arrows is not drawn, so a big one never freezes a phone. We measured those limits on a real iPhone and a real Android phone, and the charts show why.

On this page: [/demo/phones](/demo/phones).

### More AI apps, one page to start

You can now start at [docs.plus/mcp](https://docs.plus/mcp), which gives the server URL and the steps for each AI app. Settings › Connected apps adds Claude Code, Codex, Copilot CLI and Cline, plus Add to LM Studio and Add to Replit — needs an account.

Your AI app can write diagrams too. docs.plus checks each one before the write, and tells the app why it refused one. On this page: [/demo/connected app](/demo/connected%20app).

### No more missed chat

Some people showed as Online for good, even months after they left. A plain chat message then sent them no bell, push or email. Now online means a recent heartbeat, and nobody is stuck.

A chat email is skipped when you already read the message in the chatroom. Someone who is typing now shows as present in the mention list too.

### Safer by default

A private document's images now load only for its owner. New database tables and functions start closed, and a guard checks the grants after each database update.

An AI app reads document titles inside a safe frame, so a title cannot pass itself off as an instruction. This release closes 20 security issues.

### In numbers

- 103 commits in 9 days
- 53 issues closed, with 12 bugs and 20 security fixes
- 1,401 tests pass
- 6 extensions at 2.2.0

Read every change in the [GitHub Release](https://github.com/docs-plus/docs.plus/releases/tag/v2.2.0) and the [CHANGELOG](https://github.com/docs-plus/docs.plus/blob/main/CHANGELOG.md).

## docs.plus 2.1.0

![docs.plus 2.1.0: a pad with the Find bar, an AI app card, a QR code and a voice note, above the release numbers](/demo-assets/release-2.1.0-banner.png)

Released on 13 October 2026.

### Your AI app can work in your documents

You can now connect Claude, ChatGPT or another AI app to docs.plus. It signs in as you, on a consent page — needs an account.

It reads the documents and chat you can open. It edits only documents you own, so it can read this page but never change it.

A version that an app wrote carries a Connected app badge in History. On this page: [/demo/connected app](/demo/connected%20app).

### An email when other people edit

You can now get a change digest email when other people edit a document you follow. It marks added and removed words under each changed heading — needs an account.

You follow a document when you open it while signed in. You get no mail for edits you saw live. On this page: [/demo/digest](/demo/digest).

### Find, jump and insert from the keyboard

On desktop, you can now press `⌘+F` or `Ctrl+F` for a Find bar that counts the matches — try it here.

You can now press `⌘+⇧+K` or `Ctrl+Shift+K` to jump to History, Filter, Find or a new document — try it here.

You can now type `/` on an empty line to insert a block — needs a document you can edit. Try it in [/new](/new).

On this page: [/demo/find bar](/demo/find%20bar).

### Share a document with a QR code

You can now share a document with a QR code. Open Share and scan the code, or click it for a full-screen Present view — try it here.

Present can switch to a dark background for a dark room. On desktop, the Document QR code button keeps the code in a QR card on the page — try it here.

The Share card now shares the whole document, never the heading or filter you are on. On this page: [/demo/qr code](/demo/qr%20code).

### Give the chatroom the full width

On desktop, you can now drag the divider below 120px, and the table of contents turns into a 32px tick rail. The docked chatroom then spans the full width — try it here.

On desktop, you can now drag the top edge of the docked chatroom down to close it — try it here.

On desktop, the heading chat button now shows while you hover anywhere in its section — try it here. On this page: [/demo/docked chatroom](/demo/docked%20chatroom).

### Voice notes you hold to record

You can now record a voice note on a phone by holding the mic. Slide up to lock, slide left to cancel, and let go to send — needs an account.

Chat audio now plays with seek, at 1×, 1.5× or 2× speed. A new voice note shows its waveform and length before you press play. Post one to hear it — needs an account.

On this page: [/demo/voice note](/demo/voice%20note).

### A calmer, clearer page

Cards, dialogs, menus and phone sheets now share one look. Every confirmation uses one dialog, with Cancel first.

Headings in a block now follow one size scale, from 24pt down to 14pt. Loading screens now match the page they turn into, so nothing jumps when content arrives.

On desktop, menus now open from the keyboard. On a focused table of contents row, `Shift+F10` or the Menu key opens its menu — try it here.

On this page: [/demo/rank](/demo/rank).

### Your documents on every device

You can now see the documents you own and the ones you joined in one list. Favorite the ones you own to keep them at the top, and sort by Last opened — needs an account.

A setting you save now shows in every open tab, and on every device where you are signed in — needs an account.

Home now has an Install app button. Share a Word or Markdown file into the installed app, and it becomes a new document you own — needs an account.

On this page: [/demo/documents list](/demo/documents%20list).

### Safer by default

A private document's chatroom now opens only for its owner. Files in Trash are no longer served, and server errors no longer show database text.

Chat messages and channels now accept changes only from the people allowed to make them. This release closes 33 security issues.

### In numbers

- 559 commits in 43 days
- 136 issues closed, with 71 bugs and 33 security fixes
- 1,216 tests pass
- 5 extensions at 2.1.0

Read every change in the [GitHub Release](https://github.com/docs-plus/docs.plus/releases/tag/v2.1.0) and the [CHANGELOG](https://github.com/docs-plus/docs.plus/blob/main/CHANGELOG.md).

Filtered to this section? [Show the whole document](/demo).
