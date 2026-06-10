/**
 * Layout and styling options for image positioning and display
 */
export interface ImageLayoutOptions {
  /** Image width in pixels */
  width?: number | null
  /** Image height in pixels */
  height?: number | null
  /** CSS margin property */
  margin?: string
  /** CSS clear property */
  clear?: string
  /** CSS float property */
  float?: string | null
  /** CSS display property */
  display?: string
}

/**
 * Node configuration options for image behavior
 */
export interface ImageNodeOptions {
  /** Additional HTML attributes to apply to the image element */
  HTMLAttributes: Record<string, any>
}

/**
 * Complete image extension options
 */
export interface ImageOptions extends ImageLayoutOptions, ImageNodeOptions {
  /** Allow base64 data URLs */
  allowBase64: boolean
  /** Render as inline element instead of block */
  inline: boolean
}

/**
 * Options for creating a new image
 */
export type SetImageOptions = {
  /** Image source URL */
  src: string
  /** Alternative text for accessibility */
  alt?: string
  /** Image title attribute */
  title?: string
} & ImageLayoutOptions

/**
 * Parameters for updating image dimensions
 */
export interface UpdateImageDimensionsParams {
  /** Unique key identifier for the image */
  keyId: string
  /** New width value */
  width?: number | null
  /** New height value */
  height?: number | null
}
