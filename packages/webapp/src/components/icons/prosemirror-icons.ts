/**
 * String-template SVG icons for ProseMirror / Tiptap plugins.
 *
 * These icons return raw HTML strings (not JSX) because they're injected into
 * the DOM via `element.innerHTML` in ProseMirror widget factories — outside of
 * the React tree.
 *
 * All other UI icons must use Lucide (`react-icons/lu`) per the design system §3.5.
 */

interface StringIconProps {
  size?: number
  fill?: string
  className?: string
}

/** Filled chat bubble with text lines — used in heading hover decorations. */
export const ChatLeftSVG = ({
  size = 24,
  fill = 'currentColor',
  className = ''
}: StringIconProps) => `
    <svg
      class="${className}"
      fill="${fill}"
      stroke-width="0"
      viewBox="0 0 16 16"
      width="${size}"
      xmlns="http://www.w3.org/2000/svg">
      <path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4.414a1 1 0 0 0-.707.293L.854 15.146A.5.5 0 0 1 0 14.793V2zm3.5 1a.5.5 0 0 0 0 1h9a.5.5 0 0 0 0-1h-9zm0 2.5a.5.5 0 0 0 0 1h9a.5.5 0 0 0 0-1h-9zm0 2.5a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5z"></path>
    </svg>
`

/** Add-comment icon — used in selection and hover chat decorations. */
export const AddCommentSVG = ({
  size = 18,
  fill = 'currentColor',
  className = ''
}: StringIconProps) => `
    <svg
        class="${className}"
        fill="${fill}"
        width="${size}"
        stroke-width="0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path fill="none" d="M0 0h24v24H0V0z"></path>
      <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM17 11h-4v4h-2v-4H7V9h4V5h2v4h4v2z"></path>
    </svg>
`
