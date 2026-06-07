# Image Extension - Advanced Media Handling

A powerful, performance-optimized image extension for TipTap with advanced resize capabilities, smart toolbars, and seamless user experience. Block or inline level node with enterprise-grade features.

> **Next-Gen Features:** This extension includes advanced resize grippers, floating toolbars, smart paste handling, and optimized performance for professional document editing.

## Installation

```bash
bun add @docs.plus/extension-hypermultimedia
```

```js
import { HyperMultimediaKit } from '@docs.plus/extension-hypermultimedia'

HyperMultimediaKit.configure({
  Image
})
```

## 🚀 Key Features

### Advanced Resize System

- **Corner Clamps**: Free resize in both dimensions with aspect ratio control
- **Side Clamps**: Constrained resize (width-only or height-only)
- **Shift Key Support**: Hold Shift for aspect ratio maintenance
- **Smart Calculation**: Automatically determines optimal resize direction
- **Real-time Preview**: Smooth visual feedback during resize operations
- **Performance Optimized**: No re-renders during resize for better UX

### Intelligent Toolbar System

- **Floating Toolbar**: Context-aware positioning with viewport detection
- **Smart Hide/Show**: Automatically hides during resize, restores after completion
- **Media Placement Controls**: Inline, center, float left/right options
- **Margin Controls**: Precise margin adjustments with visual presets
- **Touch Support**: Full mobile device compatibility

### Storage & State Management

- **Dimension Persistence**: Maintains image dimensions across sessions
- **Key-based Tracking**: Unique identifiers for reliable state management
- **Transaction Optimization**: Efficient ProseMirror state updates
- **Memory Management**: Proper cleanup to prevent memory leaks

### Smart Paste & URL Handling

- **Auto Image Detection**: Automatically converts pasted image URLs
- **Format Support**: JPG, PNG, GIF, WebP, SVG, AVIF, HEIC, and more
- **Data URL Support**: Base64 image handling (when enabled)
- **Blob URL Support**: Local file handling

## Settings

### inline

Controls if the node should be handled inline or as a block.

- Target: `Node`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Image: {
    inline: true
  }
})
```

### allowBase64

Allow images to be parsed as base64 strings `<img src="data:image/jpg;base64...">`.

- Target: `Node`
- Default: `false`

```js
HyperMultimediaKit.configure({
  Image: {
    allowBase64: true
  }
})
```

### toolbar

Advanced floating toolbar with media controls and placement options.

- Target: `Node`
- Default: `MediaToolbar` (advanced toolbar with placement controls)

```js
HyperMultimediaKit.configure({
  Image: {
    toolbar: createMediaToolbar // Advanced toolbar (default)
  }
})
```

The toolbar includes:

- **Placement Controls**: Inline, center, float left/right
- **Margin Presets**: 0", 1/16", 1/8", 1/4", 3/8", 1/2", 3/4", 1"
- **Smart Positioning**: Viewport-aware positioning
- **Touch Support**: Mobile-friendly interactions

### resizeGripper

Advanced resize system with corner and side clamps.

- Target: `Node`
- Default: `true`

```js
HyperMultimediaKit.configure({
  Image: {
    resizeGripper: true // Enables advanced resize system
  }
})
```

**Resize Features:**

- **Corner Clamps**:
  - Normal drag: Free resize in both dimensions
  - Shift + drag: Constrained resize maintaining aspect ratio
  - Smart calculation: Width or height drives based on drag direction
- **Side Clamps**:
  - Horizontal clamps: Width-only resize
  - Vertical clamps: Height-only resize
  - Position compensation for left/top clamps
- **Visual Feedback**: Real-time preview during drag operations
- **Performance**: Optimized event handling with RAF updates

### HTMLAttributes

Custom HTML attributes added to the rendered HTML tag.

- Target: `Node`
- Default: `{}`

```js
HyperMultimediaKit.configure({
  Image: {
    HTMLAttributes: {
      class: 'my-custom-class',
      'data-custom': 'value'
    }
  }
})
```

## Caption

Add a caption from the toolbar; the text is stored in the node `caption` attribute
and persists via collaboration and JSON. Image is the only node whose caption also
round-trips through standalone HTML as `<figure>/<figcaption>`. Image, video, and
audio also expose a Download action.

## Markdown Syntax

Markdown export keeps `![alt](src)` only — the caption is not represented.

```md
![alt text](src alt)
![alt text](https://example.com/foobar.png)
```

## Commands

### setImage()

Creates an image node with advanced dimension and placement control.

```js
// Basic usage
editor.commands.setImage({
  src: 'https://example.com/image.png'
})

// With metadata
editor.commands.setImage({
  src: 'https://example.com/image.png',
  alt: 'Professional image'
})

// With layout control
editor.commands.setImage({
  src: 'https://example.com/image.png',
  width: 400,
  height: 300,
  float: 'left',
  clear: 'none',
  display: 'block',
  margin: '0.5in'
})
```

### updateImageDimensions()

Sets the `width` / `height` attributes of the image with the given `keyId`.

```js
editor.commands.updateImageDimensions({
  keyId: 'img-abc123',
  width: 500,
  height: 350
})
```

## Command Options

| Option  | Description                                    | Default | Optional |
| ------- | ---------------------------------------------- | ------- | -------- |
| src     | The URL of the image                           | `null`  |          |
| width   | Image width in pixels                          | `null`  | ✅       |
| height  | Image height in pixels                         | `null`  | ✅       |
| float   | CSS `float` property (`left`, `right`, `none`) | `null`  | ✅       |
| clear   | CSS `clear` property                           | `none`  | ✅       |
| display | CSS `display` property                         | `block` | ✅       |
| margin  | CSS `margin` property (supports inch units)    | `auto`  | ✅       |
| alt     | Alternative text for accessibility             | `null`  | ✅       |
| title   | Image title attribute                          | `null`  | ✅       |

## Performance Optimizations

### Event Management

- **Efficient Listeners**: Proper cleanup of event listeners
- **RAF Optimization**: Uses `requestAnimationFrame` for smooth UI updates
- **Memory Leak Prevention**: Comprehensive cleanup tracking
- **Touch Event Handling**: Optimized mobile interactions

### State Management

- **Transaction Batching**: Efficient ProseMirror state updates
- **Constraint Checking**: Early validation prevents unnecessary DOM updates
- **Keyboard Monitoring**: Lightweight Shift key detection
- **Single Source of Truth**: Dimensions live on the node attributes, so resizes persist and sync

### Visual Performance

- **No Re-renders**: Resize operations happen without node re-renders
- **Smooth Transitions**: Hardware-accelerated animations
- **Viewport Awareness**: Smart toolbar positioning
- **Intersection Observers**: Efficient visibility tracking

## Advanced Usage

### Custom Resize Constraints

```js
// Minimum size constraints are built-in
const DEFAULT_CONSTRAINTS = {
  minWidth: 160,
  minHeight: 80
}
```

### Event Handling

Resize handles and the floating placement toolbar are wired automatically by the
kit: hover (desktop) or tap (touch) a media node and the controls appear. The
image node adds one plugin of its own, for clipboard handling:

```js
// Inserts an image from a pasted file or URL
HyperImagePastePlugin(editor, { nodeName: 'Image' })
```

### Dimension Persistence

Each image gets a unique `keyId`, and its `width` / `height` are stored as node
attributes — the single source of truth. Resizes are committed with
`setNodeMarkup`, so they survive re-renders and sync through collaboration:

```js
// Each image gets a unique keyId
const keyId = generateShortId()

// Resize commits dimensions onto the node attributes
editor.commands.updateImageDimensions({ keyId, width, height })
```

## Browser Support

- ✅ Modern browsers with touch event support
- ✅ Mobile Safari and Chrome
- ✅ Desktop Chrome, Firefox, Safari, Edge
- ✅ Intersection Observer support required for advanced features

## Source Code

- [Main Implementation](./image.ts) - Core image node, attributes, and resize commands
- [Helper Functions](./helper.ts) - URL detection and input rules
- [Plugin System](./plugin.ts) - Clipboard paste detection
- [Resize System](../extensions/decoration/) - Advanced resize grippers and controls
- [Toolbar System](../../toolbar/) - Declarative action registry and renderer

## Migration from Basic Image Extensions

This extension provides backward compatibility while adding advanced features. Existing `setImage` commands will work seamlessly with enhanced capabilities.

```js
// Before: Basic image insertion
editor.commands.setImage({ src: 'image.jpg' })

// After: Enhanced with storage and controls (same API)
editor.commands.setImage({ src: 'image.jpg' }) // Now includes keyId tracking, toolbar, resize grippers
```
