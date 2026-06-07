# @docs.plus/extension-inlinecode

A Tiptap extension for inline code formatting.

## Features

- Inline code formatting with backticks
- Keyboard shortcuts for toggling inline code
- Smart cursor navigation around inline code
- Input rules for automatic formatting

## Installation

```bash
npm install @docs.plus/extension-inlinecode
```

## Usage

```javascript
import { Editor } from '@tiptap/core'
import { InlineCode } from '@docs.plus/extension-inlinecode'

const editor = new Editor({
  extensions: [
    InlineCode.configure({
      HTMLAttributes: {
        class: 'my-custom-class'
      }
    })
  ]
})
```

## Commands

- `setInlineCode()` - Set inline code formatting
- `toggleInlineCode()` - Toggle inline code formatting
- `unsetInlineCode()` - Remove inline code formatting

## Keyboard Shortcuts

- `Mod-Shift-c` - Toggle inline code
- `Mod-e` - Toggle inline code
- `ArrowRight` - Smart navigation out of inline code
- `ArrowLeft` - Smart navigation into inline code

## Input Rules

Type text between backticks (\`) to automatically format as inline code.

## License

MIT
