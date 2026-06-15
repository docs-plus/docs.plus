interface IconProps {
  size?: number
  fill?: string
  className?: string
}

const VIEW_BOX = '0 -960 960 960'

/** Google Material Symbols (outlined) path → inline SVG for imperative toolbar DOM. */
function materialIcon(
  path: string,
  { size = 20, fill = 'currentColor', className = '' }: IconProps = {}
): string {
  const klass = className ? ` class="${className}"` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg"${klass} height="${size}" width="${size}" viewBox="${VIEW_BOX}" fill="${fill}" aria-hidden="true"><path d="${path}"/></svg>`
}

/** Official Material Symbols outlined paths — matches `@docs.plus/extension-hyperlink` icon style. */
const PATHS = {
  alignLeft:
    'M120-120v-80h720v80H120Zm0-160v-80h480v80H120Zm0-160v-80h720v80H120Zm0-160v-80h480v80H120Zm0-160v-80h720v80H120Z',
  alignCenter:
    'M120-120v-80h720v80H120Zm160-160v-80h400v80H280ZM120-440v-80h720v80H120Zm160-160v-80h400v80H280ZM120-760v-80h720v80H120Z',
  alignRight:
    'M120-120v-80h720v80H120Zm240-160v-80h480v80H360ZM120-440v-80h720v80H120Zm240-160v-80h480v80H360ZM120-760v-80h720v80H120Z',
  imageLeft:
    'M120-280v-400h400v400H120Zm80-80h240v-240H200v240Zm-80-400v-80h720v80H120Zm480 160v-80h240v80H600Zm0 160v-80h240v80H600Zm0 160v-80h240v80H600ZM120-120v-80h720v80H120Z',
  imageRight:
    'M440-280v-400h400v400H440Zm80-80h240v-240H520v240ZM120-120v-80h720v80H120Zm0-160v-80h240v80H120Zm0-160v-80h240v80H120Zm0-160v-80h240v80H120Zm0-160v-80h720v80H120Z',
  caption:
    'M240-320h320v-80H240v80Zm400 0h80v-80h-80v80ZM240-480h80v-80h-80v80Zm160 0h320v-80H400v80ZM160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm0-80h640v-480H160v480Zm0 0v-480 480Z',
  externalLink: 'M256-240 200-296l384-384H320v-80h400v400h-80v-264L256-240Z',
  download:
    'M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z',
  replaceUrl:
    'M280-120 80-320l200-200 57 56-104 104h607v80H233l104 104-57 56Zm400-320-57-56 104-104H120v-80h607L623-784l57-56 200 200-200 200Z',
  copy: 'M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z',
  trash:
    'M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z',
  more: 'M240-400q-33 0-56.5-23.5T160-480q0-33 23.5-56.5T240-560q33 0 56.5 23.5T320-480q0 33-23.5 56.5T240-400Zm240 0q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm240 0q-33 0-56.5-23.5T640-480q0-33 23.5-56.5T720-560q33 0 56.5 23.5T800-480q0 33-23.5 56.5T720-400Z'
} as const

type IconRenderer = (props?: IconProps) => string

function icon(path: string): IconRenderer {
  return (props) => materialIcon(path, props)
}

export const AlignLeft = icon(PATHS.alignLeft)
export const AlignCenter = icon(PATHS.alignCenter)
export const AlignRight = icon(PATHS.alignRight)
export const ImageLeft = icon(PATHS.imageLeft)
export const ImageRight = icon(PATHS.imageRight)
export const Caption = icon(PATHS.caption)
export const ExternalLink = icon(PATHS.externalLink)
export const Download = icon(PATHS.download)
export const Replace = icon(PATHS.replaceUrl)
export const Copy = icon(PATHS.copy)
export const Trash = icon(PATHS.trash)
export const More = icon(PATHS.more)
