# Hyperlink

The Hyperlink extension adds support for tags to the editor. The extension is headless too, there is no actual UI to add, modify or delete links. The usage example below uses the native JavaScript prompt to show you how that could work.

In a real world application, you would probably add a more sophisticated user interface.

Pasted URLs will be transformed to links automatically.

## Installation

````sh
npm install @docsplus/extension-hyperlink
````

## Settings

### protocols

Additional custom protocols you would like to be recognized as links.

Default: []

````js
Hyperlink.configure({
  protocols: ['ftp', 'mailto'],
})
````

By default, linkify adds // to the end of a protocol however this behavior can be changed by passing optionalSlashes option

````js
Hyperlink.configure({
  protocols: [
    {
      scheme: 'tel',
      optionalSlashes: true
    }
  ]
})
````

### autolink

If enabled, it adds links as you type.

Default: true

````js
Hyperlink.configure({
  autolink: false,
})
````

### openOnClick

If enabled, links will be opened on click.

Default: true

````js
Hyperlink.configure({
  openOnClick: false,
})
````

### linkOnPaste

Adds a link to the current selection if the pasted content only contains an url.

Default: true

````js
Hyperlink.configure({
  linkOnPaste: false,
})
````

### HTMLAttributes

Custom HTML attributes that should be added to the rendered HTML tag.

````js
Hyperlink.configure({
  HTMLAttributes: {
    class: 'my-custom-class',
  },
})
````

### Modals

The modals configuration option lets you incorporate an interactive user interface similar to Google Docs for setting and previewing hyperlinks. This provides users with a more intuitive and interactive experience; [More details in the code](https://github.com/HMarzban/extension-hyperlink/blob/4f37ffa18237f10d76c316844b1c2ab20b751fe9/packages/nextjs/src/components/Tiptap.tsx#L21-L28).
````js
Hyperlink.configure({
  modals: {
    previewHyperlink: (data) => {
      return previewHyperlinkModal(data);
    },
    setHyperlink: (data) => {
      return setHyperlinks(data);
    },
  },
})
````

### Removing and overriding existing html attributes

You can add rel: null to HTMLAttributes to remove the default rel="noopener noreferrer nofollow". You can also override the default by using rel: "your-value".

This can also be used to change the target from the default value of _blank.

````js
Hyperlink.configure({
  HTMLAttributes: {
    // Change rel to different value
    // Allow search engines to follow links(remove nofollow)
    rel: 'noopener noreferrer',
    // Remove target entirely so links open in current tab
    target: null,
  },
})
````

### validate

A function that validates every autolinked link. If it exists, it will be called with the link href as argument. If it returns false, the link will be removed.

Can be used to set rules for example excluding or including certain domains, tlds, etc.

````js
// only autolink urls with a protocol
Hyperlink.configure({
  validate: href => /^https?:\/\//.test(href),
})
````

## Commands

### editHyperLinkText(), editHyperLinkHref(), editHyperlink()

These commands allow you to edit the text and href value of a hyperlink.

```js
editor.commands.editHyperLinkText('New Text')
editor.commands.editHyperLinkHref('https://new-url.com')
editor.commands.editHyperlink({
  newText: 'New Text', newURL: 'https://new-url.com'
})
```

### setHyperlink()

Links the selected text.

````js
editor.commands.setHyperlink({ href: '<https://example.com>' })
editor.commands.setHyperlink({ href: '<https://example.com>', target: '_blank' })
editor.commands.unsetHyperlink()
````

### unsetHyperlink()

Removes a Hyperlink.

````js
editor.commands.unsetHyperlink()
````

## Keyboard shortcuts

Doesn’t have a keyboard shortcut
This extension doesn’t bind a specific keyboard shortcut. You would probably open your custom UI on Mod-k though.
