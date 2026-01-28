# Hyperlink

[![Version](https://img.shields.io/npm/v/@docs.plus/extension-hyperlink.svg?label=version)](https://www.npmjs.com/package/@docs.plus/extension-hyperlink)
[![Downloads](https://img.shields.io/npm/dm/@docs.plus/extension-hyperlink.svg)](https://npmcharts.com/compare/@docs.plus/extension-hyperlink)
[![License](https://img.shields.io/npm/l/@docs.plus/extension-hyperlink.svg)](https://www.npmjs.com/package/@docs.plus/extension-hyperlink)

The Link extension adds support for `<a>` tags to the editor. The extension is headless too, there is no actual UI to add, modify or delete links. The usage example below uses the native JavaScript prompt to show you how that could work.

In a real world application, you would probably add a more sophisticated user interface.

> **Smart Auto-Linking**: URLs are automatically detected and converted to links, with intelligent markdown syntax protection and punctuation handling.

## ✨ Enhanced URL Support

This extension provides comprehensive support for:

- **Standard URLs**: `https://example.com`, `http://example.com`
- **Communication**: `mailto:user@example.com`, `tel:+1234567890`, `sms:+1234567890`
- **Social Media**: `whatsapp://send?text=hello`, `discord://user/123`, `tg://resolve?domain=username`
- **Video Conferencing**: `zoommtg://zoom.us/join?confno=123`, `msteams://l/meetup-join/19:meeting`
- **Development Tools**: `github://user/repo`, `vscode://file/path`, `figma://file/abc123`
- **Apple Apps**: `maps://address`, `music://album/123`, `facetime://user@example.com`
- **Entertainment**: `youtube://watch?v=abc123`, `spotify://track/123`, `twitch://stream/username`
- **And 50+ more special schemes**

All these URL types are automatically detected and converted to clickable links as you type!

**Smart Features:**

- 🧠 **Markdown-aware**: Converts `[text](url)` to links, protects `![image](url)` syntax
- 🔗 **URL Normalization**: Automatically adds `https://` to URLs without protocols
- 🧹 **Clean URLs**: Automatically removes trailing punctuation
- ⚡ **Priority handling**: Works seamlessly with other extensions

## Installation

```sh
npm install @docsplus/extension-hyperlink
```

## Settings

### protocols

Additional custom protocols you would like to be recognized as links.

Default: `[]`

```js
Hyperlink.configure({
  protocols: ['ftp', 'mailto']
})
```

By default, [linkify](https://linkify.js.org/docs/) adds `//` to the end of a protocol however this behavior can be changed by passing `optionalSlashes` option

```js
Hyperlink.configure({
  protocols: [
    {
      scheme: 'tel',
      optionalSlashes: true
    }
  ]
})
```

**Note**: The extension automatically supports 50+ special URL schemes including `mailto:`, `tel:`, `whatsapp:`, `discord:`, `zoom:`, `github:`, `vscode:`, `spotify:`, and many more. You only need to configure additional protocols if you have custom schemes not already supported.

### autolink

If enabled, it adds links as you type.

Default: `true`

```js
Hyperlink.configure({
  autolink: false
})
```

### openOnClick

If enabled, links will be opened on click.

Default: `true`

```js
Hyperlink.configure({
  openOnClick: false
})
```

### linkOnPaste

Adds a link to the current selection if the pasted content only contains an url.

Default: `true`

```js
Hyperlink.configure({
  linkOnPaste: false
})
```

### HTMLAttributes

Custom HTML attributes that should be added to the rendered HTML tag.

```js
Hyperlink.configure({
  HTMLAttributes: {
    class: 'my-custom-class'
  }
})
```

### Markdown-Aware Auto-Linking

The extension intelligently respects markdown syntax and provides clean URL detection:

#### Markdown Syntax Protection

Auto-linking intelligently handles markdown syntax:

```markdown
![Alt text](https://example.com/image.jpg) ❌ Won't auto-link (protected for image syntax)
[Link text](https://example.com/page.html) ✅ Converts to hyperlink (link syntax)
Visit https://example.com ✅ Will auto-link (normal text)
```

**Markdown Link Syntax**: `[text](url)` is automatically converted to proper hyperlinks with the text as the display and url as the href.

**URL Normalization**: URLs without protocols are automatically normalized:

```markdown
[Google](www.google.com) → Becomes link to https://www.google.com
[Example](example.com) → Becomes link to https://example.com
[Full URL](https://site.com) → Becomes link to https://site.com (unchanged)
```

**Image Syntax Protection**: `![alt](url)` patterns are protected to allow image input rules to work correctly.

#### Smart Punctuation Handling

URLs are automatically cleaned of trailing punctuation that's not part of the actual URL:

```
Check out (https://example.com) for details.  → https://example.com
Visit https://example.com!                    → https://example.com
See https://example.com.                      → https://example.com
```

Cleaned punctuation includes: `. , ; : ! ? ) ] }`

#### Priority Handling

The extension works seamlessly with other TipTap extensions through intelligent priority management, ensuring markdown input rules and auto-linking coexist without conflicts.

### Toolbars

The toolbars configuration option lets you incorporate an interactive user interface similar to Google Docs for setting and previewing hyperlinks. This provides users with a more intuitive and interactive experience;

- [Dive into the code](https://github.com/HMarzban/extension-hyperlink/blob/4f37ffa18237f10d76c316844b1c2ab20b751fe9/packages/nextjs/src/components/Tiptap.tsx#L21-L28)
- [Demo](https://github.com/HMarzban/extension-hyperlink#test-drive-with-our-demo-)

<details>
<summary>The `previewHyperlinkToolbar` function</summary>

```ts
type HyperlinkToolbarOptions = {
  editor: Editor;
  validate?: (url: string) => boolean;
  view: EditorView;
  link: HTMLAnchorElement;
  node?: any;
  nodePos: number;
  tippy: Tooltip;
};

const previewHyperlink(options: HyperlinkToolbarOptions): HTMLElement {
  const href = options.link.href;
  const hyperlinkLinkToolbar = document.createElement("div");

  const hrefTitle = document.createElement("a");
  hrefTitle.setAttribute("target", "_blank");
  hrefTitle.setAttribute("rel", "noreferrer");
  hrefTitle.setAttribute("href", href);
  hrefTitle.innerText = href;

  hyperlinkLinkToolbar.append(hrefTitle);

  return hyperlinkLinkToolbar;
}
```

</details>

<details>
<summary>The `setHyperlinks` function</summary>

```ts
type setHyperlinkToolbarOptions = {
  editor: Editor;
  validate?: (url: string) => boolean;
  extentionName: string;
  attributes: Record<string, any>;
};

let tooltip: Tooltip = undefined;


const setHyperlink(options: setHyperlinkToolbarOptions): void {
  // Create the tooltip instance
  if (!tooltip) tooltip = new Tooltip({ ...options, view: options.editor.view });

  // Initialize the tooltip
  let { tippyToolbar } = tooltip.init();

  const hyperlinkLinkToolbar = document.createElement("div");
  const buttonsWrapper = document.createElement("div");
  const inputsWrapper = document.createElement("div");

  hyperlinkLinkToolbar.classList.add("hyperlinkLinkToolbar");

  buttonsWrapper.classList.add("buttonsWrapper");
  inputsWrapper.classList.add("inputsWrapper");

  // create a form that contain url input and a button for submit
  const form = document.createElement("form");
  const input = document.createElement("input");
  const button = document.createElement("button");

  input.setAttribute("type", "text");
  input.setAttribute("placeholder", "https://example.com");
  button.setAttribute("type", "submit");
  button.innerText = "Submit";

  inputsWrapper.append(input);
  buttonsWrapper.append(button);
  form.append(inputsWrapper, buttonsWrapper);

  hyperlinkLinkToolbar.append(form);

  tippyToolbar.innerHTML = "";
  tippyToolbar.append(hyperlinkLinkToolbar);

    // event listenr for submit button
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const url = input.value;
    if (!url)return;

    return options.editor
      .chain()
      .setMark(options.extentionName, { href: url})
      .setMeta("preventautohyperlink", true)
      .run();
  });
}
```

</details>

```ts
Hyperlink.configure({
  toolbars: {
    previewHyperlink: (data) => {
      return previewHyperlinkToolbar(data)
    },
    setHyperlink: (data) => {
      return setHyperlinks(data)
    }
  }
})
```

### Removing and overriding existing html attributes

You can add `rel: null` to HTMLAttributes to remove the default `rel="noopener noreferrer nofollow"`. You can also override the default by using `rel: "your-value"`.

This can also be used to change the `target` from the default value of `_blank`.

```js
Hyperlink.configure({
  HTMLAttributes: {
    // Change rel to different value
    // Allow search engines to follow links(remove nofollow)
    rel: 'noopener noreferrer',
    // Remove target entirely so links open in current tab
    target: null
  }
})
```

### validate

A function that validates every autolinked link. If it exists, it will be called with the link href as argument. If it returns `false`, the link will be removed.

Can be used to set rules for example excluding or including certain domains, tlds, etc.

```js
// only autolink urls with a protocol
Hyperlink.configure({
  validate: (href) => /^https?:\/\//.test(href)
})
```

## Commands

### editHyperLinkText(), editHyperLinkHref(), editHyperlink()

These commands allow you to edit the text and href value of a hyperlink.

```js
this.editor.commands.editHyperLinkText('New Text')
this.editor.commands.editHyperLinkHref('https://new-url.com')
this.editor.commands.editHyperlink({
  newText: 'New Text',
  newURL: 'https://new-url.com'
})
```

### setHyperlink()

Links the selected text.

```js
this.editor.commands.setHyperlink({ href: '<https://example.com>' })
this.editor.commands.setHyperlink({ href: '<https://example.com>', target: '_blank' })
this.editor.commands.unsetHyperlink()
```

### unsetHyperlink()

Removes a Hyperlink.

```js
this.editor.commands.unsetHyperlink()
```

## Keyboard shortcuts

The extension provides a built-in keyboard shortcut:

- **`Mod-k`** (Ctrl+k on Windows/Linux, Cmd+k on Mac): Opens a popover to create or edit a hyperlink for the current selection.

## Get the current value

Did you know that you can use `getAttributes` to find out which attributes, for example which href, is currently set? Don't confuse it with a <u>command</u> (which changes the state), it's just a method. Here is how that could look like:

```js
this.editor.getAttributes('link').href
```

## Sorce code and Example

- Demo:
  [packages/extension-hyperlink](https://github.com/HMarzban/extension-hyperlink)
- Extension:
  [packages/extension-hyperlink](https://github.com/HMarzban/extension-hyperlink/tree/main/packages/extension-hyperlink)
- Usage: [packages/nextjs/src/components/Tiptap.tsx](https://github.com/HMarzban/extension-hyperlink/blob/59f45eba1886202f4840eb2112c34574c16fe68a/packages/nextjs/src/components/Tiptap.tsx#L19-L29)

## Inspiration and Acknowledgment, Let's Connect

Hey there! Thanks so much for taking an interest in our Hyperlink extension, a part of the awesome world of docs.plus. At docs.plus, we're all about making collaboration and knowledge sharing not just simpler, but downright enjoyable!

Let us share a little behind-the-scenes story with you. Our extension was inspired by Tiptap's [extension-link](https://github.com/ueberdosis/tiptap/tree/main/packages/extension-link). We were so impressed by their "headless" approach that we decided to take it further and add our own touch to make it even more user-friendly and versatile.

Now, let's be clear, we're not officially affiliated with Tiptap, but we firmly believe in giving credit where it's due. Their brilliant work laid the foundation for our extension, and we're truly grateful for that!

But enough about us, let's talk about you! We genuinely appreciate your interest in our work. If you have any ideas or suggestions on how we can make this extension even better, or if you're simply curious about Docs.plus, we'd love to chat.

If you want to dive deeper into what we're all about, feel free to explore the [docs.plus repository](https://github.com/docs-plus/docs.plus) - it's there for you!

Once again, thank you for dropping by. We're thrilled to see what incredible things we can create together in this amazing world of open source!
