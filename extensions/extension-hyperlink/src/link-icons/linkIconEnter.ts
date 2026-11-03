import { Plugin } from '@tiptap/pm/state'

// prosemirror-view's own test (browser.ts), so this runs exactly where it skips the Enter keydown.
const chromeAndroid = (): boolean =>
  typeof navigator !== 'undefined' &&
  /Android \d/.test(navigator.userAgent) &&
  /Chrome\/\d/.test(navigator.userAgent)

// Built like prosemirror-view's keyEvent(), which handleKeyDown props expect.
const enterKey = (): KeyboardEvent => {
  const event = document.createEvent('Event') as KeyboardEvent & { keyCode: number }
  event.initEvent('keydown', true, true)
  Object.assign(event, { keyCode: 13, key: 'Enter', code: 'Enter' })
  return event
}

/**
 * Chrome on Android splits the block itself before an iconed link and adds a `<br>`, which reads
 * back as a hard break (#513). Run the editor's Enter instead, before Chrome edits the DOM.
 */
export const linkIconEnter = (markName: string): Plugin =>
  new Plugin({
    props: {
      handleDOMEvents: {
        beforeinput(view, event) {
          if (event.inputType !== 'insertParagraph' || view.composing || !chromeAndroid())
            return false
          const { empty, $from } = view.state.selection
          if (!empty || !$from.nodeAfter?.marks.some((m) => m.type.name === markName)) return false
          if (!view.someProp('handleKeyDown', (f) => f(view, enterKey()))) return false
          event.preventDefault()
          return true
        }
      }
    }
  })
