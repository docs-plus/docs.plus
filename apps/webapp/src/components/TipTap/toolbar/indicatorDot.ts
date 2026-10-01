/** The red dot on an icon button: active filters, or bookmarks in progress. The ring is the surface colour. */
export const indicatorDotClassName = (ring: 'ring-base-100' | 'ring-base-200') =>
  `bg-error absolute top-0.5 right-0.5 size-1.5 rounded-full ring-2 ${ring}`
