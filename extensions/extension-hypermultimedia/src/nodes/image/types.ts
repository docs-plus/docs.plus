export interface ImageLayoutOptions {
  width?: number | null
  height?: number | null
  margin?: string
  clear?: string
  float?: string | null
  display?: string
}

export interface ImageNodeOptions {
  HTMLAttributes: Record<string, any>
}

export interface ImageOptions extends ImageLayoutOptions, ImageNodeOptions {
  allowBase64: boolean
  inline: boolean
}

export type SetImageOptions = {
  src: string
  alt?: string
  title?: string
  /** Caption rendered under the image (markdown export drops it — documented lossy contract) */
  caption?: string
} & ImageLayoutOptions

export interface UpdateImageDimensionsParams {
  keyId: string
  width?: number | null
  height?: number | null
}
