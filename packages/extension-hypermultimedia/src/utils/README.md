# Raw Floating Toolbar

A minimal, completely configurable floating toolbar that displays whatever you want, wherever you want it.

## Philosophy

This toolbar makes zero assumptions about your content. It's just a positioned container that shows your buttons. You provide the content, styling, and behavior - it handles the positioning and lifecycle.

## Basic Usage

```typescript
import { createFloatingToolbar } from './floating-toolbar'

const toolbar = createFloatingToolbar({
  targetElement: someElement,
  buttons: [
    {
      content: '✏️',
      onClick: () => console.log('Edit clicked'),
      title: 'Edit'
    },
    {
      content: '🗑️',
      onClick: () => console.log('Delete clicked'),
      title: 'Delete',
      style: { color: 'red' }
    }
  ]
})

toolbar.show()
```

## Complete Control

```typescript
const toolbar = createFloatingToolbar({
  targetElement: myElement,
  position: 'top',
  offset: 12,
  className: 'my-toolbar',
  style: {
    background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4)',
    borderRadius: '20px',
    padding: '4px'
  },
  buttons: [
    {
      content: '<svg>...</svg>', // Raw HTML
      onClick: (e) => handleClick(e),
      className: 'my-button',
      style: {
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        background: 'white'
      }
    },
    {
      content: document.createElement('div'), // Actual DOM element
      onClick: () => {},
      disabled: true
    },
    {
      content: '🎨', // Emoji
      onClick: () => openColorPicker()
    }
  ]
})
```

## Interface

```typescript
interface ToolbarButton {
  content: string | HTMLElement // Whatever you want to display
  onClick: (event: MouseEvent) => void
  className?: string // CSS classes
  style?: Partial<CSSStyleDeclaration> // Inline styles
  disabled?: boolean // Disable the button
  title?: string // Tooltip
}

interface FloatingToolbarOptions {
  targetElement: HTMLElement // Element to position around
  buttons: ToolbarButton[] // Your buttons
  className?: string // Toolbar CSS classes
  style?: Partial<CSSStyleDeclaration> // Toolbar styles
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  offset?: number // Distance from target
}
```

## Examples

### Text Editor Toolbar

```typescript
createFloatingToolbar({
  targetElement: textSelection,
  position: 'top',
  buttons: [
    { content: '<b>B</b>', onClick: () => makeBold() },
    { content: '<i>I</i>', onClick: () => makeItalic() },
    { content: 'Link', onClick: () => addLink() }
  ]
})
```

### Media Controls

```typescript
createFloatingToolbar({
  targetElement: videoElement,
  position: 'center',
  buttons: [
    { content: '▶️', onClick: () => video.play() },
    { content: '⏸️', onClick: () => video.pause() },
    { content: '🔊', onClick: () => toggleMute() }
  ]
})
```

### Custom DOM Elements

```typescript
const customButton = document.createElement('div')
customButton.innerHTML = '<span>Custom</span>'
customButton.style.cssText = 'border: 2px solid blue; padding: 10px;'

createFloatingToolbar({
  targetElement: someElement,
  buttons: [
    {
      content: customButton,
      onClick: () => customAction()
    }
  ]
})
```

## Styling

The toolbar has minimal default styles - just positioning and basic layout. Everything else is up to you:

```css
.my-toolbar {
  backdrop-filter: blur(10px);
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.my-toolbar button {
  color: white;
  font-size: 18px;
  padding: 12px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.my-toolbar button:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: scale(1.1);
}
```

## That's It

No helpers, no assumptions, no opinions. Just a floating container that shows your stuff where you want it.

```typescript
// Show it
toolbar.show()

// Hide it
toolbar.hide()

// Destroy it
toolbar.destroy()

// Utility functions
hideCurrentToolbar() // Hide whatever's currently showing
destroyCurrentToolbar() // Destroy current toolbar
```
