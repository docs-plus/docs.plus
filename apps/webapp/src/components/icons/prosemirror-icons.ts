/** Raw HTML strings for ProseMirror `innerHTML` widgets — not React. */

interface StringIconProps {
  size?: number
  fill?: string
  className?: string
}

/** Outline chat bubble — mobile heading tab. Matches Lucide `Icons.chatroom`. */
export const ChatOutlineSVG = ({ size = 20, className = '' }: Omit<StringIconProps, 'fill'>) => `
    <svg
      class="${className}"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      viewBox="0 0 24 24"
      width="${size}"
      height="${size}"
      xmlns="http://www.w3.org/2000/svg">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      <path d="M13 8H7"></path>
      <path d="M17 12H7"></path>
    </svg>
`

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
