# TipTap Indent Extension

This extension adds VS Code-like indentation functionality to the TipTap editor. Instead of using CSS for visual indentation, it inserts actual spaces that can be selected and manipulated.

## Features

- Inserts actual spaces/tabs at cursor position or line start
- Works like VS Code's indentation
- Handles both single cursor and multi-line selections
- Configurable indentation characters
- Keyboard shortcuts (Tab and Shift+Tab)

## Usage

```typescript
import { useEditor, EditorContent } from '@tiptap/react'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { Indent } from './path-to-indent-extension'

const editor = useEditor({
  extensions: [
    Document,
    Paragraph,
    Text,
    Indent.configure({
      indentChars: '  ', // 2 spaces for indentation
      enabled: true
    }),
  ],
  content: '<p>Hello World</p>',
})

// In your toolbar, you can add indent/outdent buttons
<button onClick={() => editor.commands.indent()}>Indent</button>
<button onClick={() => editor.commands.outdent()}>Outdent</button>
```

## How It Works

Unlike traditional indentation extensions that use CSS margins, this extension:

1. Inserts actual space characters at the cursor position or line beginnings
2. Allows these spaces to be selected and manipulated
3. Behaves similar to VS Code's tab/untab functionality

## Customizing Indentation

You can configure what characters are used for indentation:

```typescript
// Use 4 spaces
Indent.configure({
  indentChars: '    '
})

// Use tab character
Indent.configure({
  indentChars: '\t'
})
```

## Keyboard Shortcuts

- `Tab`: Insert indentation
- `Shift+Tab`: Remove indentation

## Modern TipTap Compatibility

This extension is updated to work with TipTap 2.x and follows modern best practices.
