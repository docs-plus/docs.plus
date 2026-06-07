import type { Editor } from '@tiptap/core'

import { fitLayoutToEditorColumn } from './fitImageDimensions'
import type { StyleLayoutOptions } from './utils'

export interface EmbedNodeOptions {
  inline: boolean
  addPasteHandler: boolean
  HTMLAttributes: Record<string, unknown>
}

export interface FullscreenIframeKitOptions {
  allow: string
  frameborder: number
  allowfullscreen: boolean
}

export const EMBED_CHROME_DEFAULTS = {
  justifyContent: 'start',
  margin: 'auto',
  clear: 'none',
  float: null,
  display: 'block',
  inline: false,
  addPasteHandler: true,
  HTMLAttributes: {}
} as const satisfies StyleLayoutOptions &
  Pick<EmbedNodeOptions, 'inline' | 'addPasteHandler' | 'HTMLAttributes'>

export const EMBED_BLOCK_LAYOUT_DEFAULTS = {
  ...EMBED_CHROME_DEFAULTS,
  height: 480,
  width: 640
} as const satisfies StyleLayoutOptions &
  Pick<EmbedNodeOptions, 'inline' | 'addPasteHandler' | 'HTMLAttributes'>

/** Layout attrs on embed wrappers — shared by schema defaults and iframe node-view diffs. */
export const EMBED_LAYOUT_ATTR_KEYS = [
  'height',
  'width',
  'display',
  'float',
  'clear',
  'margin',
  'justifyContent'
] as const satisfies readonly (keyof StyleLayoutOptions)[]

/** Live iframe element attrs; remount when these change on the node. */
export const FULLSCREEN_IFRAME_DOM_ATTR_KEYS = ['allow', 'frameborder', 'allowfullscreen'] as const

export const SOUNDCLOUD_IFRAME_DOM_ATTR_KEYS = ['scrolling', 'frameborder', 'allow'] as const

export function resolveEmbedOption<TOptions extends object, TKey extends keyof TOptions>(
  attrs: Record<string, unknown>,
  options: TOptions,
  key: TKey
): TOptions[TKey] | undefined {
  const fromAttrs = attrs[key as string]
  if (fromAttrs !== null && fromAttrs !== undefined) return fromAttrs as TOptions[TKey]
  return options[key]
}

export function embedAttrsEqual(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
  keys: readonly string[]
): boolean {
  return keys.every((key) => left[key] === right[key])
}

export function defaultsFromOptions<TOptions extends object>(
  options: TOptions,
  keys: readonly (keyof TOptions)[]
): Record<string, { default: unknown }> {
  const result: Record<string, { default: unknown }> = {}
  for (const key of keys) {
    result[key as string] = { default: options[key] }
  }
  return result
}

export function layoutAttrDefaults(
  options: StyleLayoutOptions
): Record<string, { default: unknown }> {
  return defaultsFromOptions(options, EMBED_LAYOUT_ATTR_KEYS)
}

/** Node schema keys mirror `kitDefaults` — extend the kit interface and its defaults object together. */
export function kitAttrDefaults<TKit extends object>(
  options: TKit,
  kitDefaults: TKit
): Record<string, { default: unknown }> {
  return defaultsFromOptions(options, Object.keys(kitDefaults) as (keyof TKit)[])
}

export function resolveEmbedLayoutDimensions(
  editor: Editor,
  options: { width?: number | string | null; height?: number | string | null },
  defaults: Pick<StyleLayoutOptions, 'width' | 'height'>
): { width: number; height: number } {
  const width = Number(options.width ?? defaults.width)
  const height = Number(options.height ?? defaults.height)
  return fitLayoutToEditorColumn(editor, width, height)
}

export function resolveFullscreenIframeAttributes(
  attrs: Record<string, unknown>,
  options: FullscreenIframeKitOptions,
  width: number,
  height: number
): Record<string, string | number | boolean> {
  return {
    width,
    height,
    allow: String(resolveEmbedOption(attrs, options, 'allow') ?? options.allow),
    frameborder: Number(resolveEmbedOption(attrs, options, 'frameborder') ?? options.frameborder),
    allowfullscreen: Boolean(
      resolveEmbedOption(attrs, options, 'allowfullscreen') ?? options.allowfullscreen
    )
  }
}
