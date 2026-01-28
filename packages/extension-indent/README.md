# @docs.plus/extension-indent

A professional Tiptap extension for text indentation management with customizable options.

## Features

- Indent/outdent at cursor position or for text selections
- Configurable indentation characters and behavior
- Node-type filtering for targeted indentation
- Tab and Shift+Tab keyboard shortcuts (configurable)
- Typescript support with full type definitions

## Installation

```bash
npm install @docs.plus/extension-indent
```

## Usage

### Basic

```js
import { Editor } from '@tiptap/core'
import { Indent } from '@docs.plus/extension-indent'

new Editor({
  extensions: [
    // ...other extensions
    Indent
  ]
})
```

### Configuration

```js
Indent.configure({
  // Character(s) for each indentation (default: '  ' - 2 spaces)
  indentChars: '    ', // 4 spaces

  // Enable/disable the extension (default: true)
  enabled: true,

  // Control which node types can be indented (default: paragraph, listItem, orderedList)
  // Empty array allows all nodes to be indented
  allowedNodeTypes: ['paragraph', 'listItem', 'orderedList']
})
```

### Examples

```js
// Use tabs instead of spaces
Indent.configure({
  indentChars: '\t'
})

// Allow indentation only for paragraphs
Indent.configure({
  allowedNodeTypes: ['paragraph']
})
```

### Commands

```js
// Add indentation
editor.commands.indent()

// Remove indentation
editor.commands.outdent()
```

### Keyboard Shortcuts

Default keyboard bindings:

- `Tab` - Indent
- `Shift+Tab` - Outdent

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development with auto-rebuild
npm run dev

# Lint code
npm run lint
```

## License

MIT
