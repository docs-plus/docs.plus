import { Editor } from '@tiptap/core'
import { Transaction } from '@tiptap/pm/state'

// ============================================================================
// Core Image Types
// ============================================================================

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
  /** Custom toolbar function or HTML string */
  toolbar?: ImageToolbarFunction | string
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

// ============================================================================
// Storage and Command Types
// ============================================================================

/**
 * Stored image dimension data
 */
export interface ImageDimensions {
  width: number | null
  height: number | null
}

/**
 * Storage structure for image dimensions by key ID
 */
export type ImageDimensionsStorage = Map<string, ImageDimensions>

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

/**
 * Parameters for retrieving image dimensions
 */
export interface GetImageDimensionsParams {
  /** Unique key identifier for the image */
  keyId: string
}

/**
 * Command execution context for dimension updates
 */
export interface ImageCommandContext {
  tr: Transaction
  dispatch?: (tr: Transaction) => void
}

// ============================================================================
// Plugin Types
// ============================================================================

/**
 * Configuration options for the HyperImage plugin
 */
export interface HyperImagePluginOptions {
  /** Name of the image node type */
  nodeName: string
  /** Optional toolbar configuration */
  toolbar?: ImageToolbarFunction | string
}

/**
 * Options for image click event handling
 */
export interface ImageClickHandlerOptions {
  /** TipTap editor instance */
  editor: Editor
  /** Optional toolbar configuration */
  toolbar?: ImageToolbarFunction | string
}

/**
 * Options for image keyboard event handling
 */
export interface ImageKeyDownHandlerOptions {
  /** Name of the image node type */
  nodeName: string
}

// ============================================================================
// Function Types
// ============================================================================

/**
 * Custom toolbar function type
 * @param target - The HTML image element that was clicked
 * @returns HTML element or string to display as toolbar
 */
export type ImageToolbarFunction = (target: HTMLElement) => HTMLElement | string

/**
 * Image URL validation function type
 */
export type ImageUrlValidator = (url: string) => boolean

// ============================================================================
// TipTap Command Extensions
// ============================================================================

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    image: {
      /**
       * Insert a new image with the specified options
       */
      setImage: (options: SetImageOptions) => ReturnType
      /**
       * Update dimensions of an existing image by key ID
       */
      updateImageDimensions: (options: UpdateImageDimensionsParams) => ReturnType
      /**
       * Retrieve stored dimensions for an image by key ID
       */
      getImageDimensions: (options: GetImageDimensionsParams) => ReturnType
    }
  }
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Supported image file extensions
 */
export type ImageExtension =
  | 'jpg'
  | 'jpeg'
  | 'png'
  | 'gif'
  | 'webp'
  | 'svg'
  | 'bmp'
  | 'ico'
  | 'tiff'
  | 'avif'
  | 'heic'
  | 'heif'
  | 'jxl'
  | 'webm'

/**
 * Image URL protocol types
 */
export type ImageUrlProtocol = 'http' | 'https' | 'data' | 'blob'

/**
 * CSS float values specifically for images
 */
export type ImageFloat = 'left' | 'right' | 'none' | 'unset' | null

/**
 * CSS clear values specifically for images
 */
export type ImageClear = 'left' | 'right' | 'both' | 'none'

/**
 * CSS display values for image rendering
 */
export type ImageDisplay = 'block' | 'inline' | 'inline-block'
