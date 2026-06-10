import { type Editor, mergeAttributes, type NodeViewRendererProps } from '@tiptap/core'
import type { NodeView, ViewMutationRecord } from '@tiptap/pm/view'

import { type CaptionHandle, createCaptionElement, readCaption } from '../caption'
import {
  layoutAttrsChanged,
  parseLayoutDimensions,
  syncElementPixelSize,
  syncMediaNodeLayout,
  wrapMediaWithLoadingShell
} from '../loading'
import { embedAttrsEqual } from './embedKit'
import { ignoreNodeViewSubtreeMutation } from './ignoreNodeViewMutation'
import { createStyleString, omitNullishAndFalse, type StyleLayoutOptions } from './utils'

export interface HtmlMediaNodeConfig {
  tag: 'video' | 'audio'
  /** Written onto the media element; doubles as the update() remount-key list. */
  elementAttrKeys: readonly string[]
  /** Pixel box when attrs carry no dimensions (audio has no intrinsic size). */
  layoutFallback?: { width: number; height: number }
  isAlreadyReady: (element: HTMLMediaElement) => boolean
}

/** `src` falls back to the rendered attr so parsed nodes keep their source. */
function pickMediaElementAttrs(
  node: { attrs: Record<string, unknown> },
  HTMLAttributes: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> {
  const picked: Record<string, unknown> = {}
  for (const key of keys) {
    picked[key] = key === 'src' ? (node.attrs.src ?? HTMLAttributes.src) : node.attrs[key]
  }
  return omitNullishAndFalse(picked)
}

export function createHtmlMediaNodeView(
  config: HtmlMediaNodeConfig,
  getExtension: () => { name: string; editor: Editor }
) {
  return function htmlMediaNodeView({
    node,
    HTMLAttributes,
    getPos
  }: NodeViewRendererProps): NodeView {
    const { name, editor } = getExtension()
    let attrsSnapshot = node.attrs
    const dom = document.createElement('div')
    const content = document.createElement('div')
    const media = document.createElement(config.tag)

    dom.classList.add(`hypermultimedia--${config.tag}__content`)
    if (node.attrs.keyId) {
      dom.setAttribute('data-key-id', String(node.attrs.keyId))
    }

    const dims = parseLayoutDimensions(node.attrs, config.layoutFallback)
    const htmlAttributes = pickMediaElementAttrs(node, HTMLAttributes, config.elementAttrKeys)

    Object.entries(mergeAttributes(htmlAttributes, { 'data-node-name': name })).forEach(
      ([key, value]) => {
        if (value !== undefined && value !== null && value !== false) {
          media.setAttribute(key, String(value))
        }
      }
    )

    content.append(media)

    const { dom: loadingHost, controller } = wrapMediaWithLoadingShell(
      editor,
      { kind: config.tag, width: dims.width, height: dims.height },
      content,
      {
        bindLoad: {
          element: media,
          isAlreadyReady: () => config.isAlreadyReady(media)
        }
      }
    )

    dom.append(loadingHost)
    syncMediaNodeLayout({
      wrapper: dom,
      attrs: node.attrs,
      loadingHost,
      surface: media,
      dims,
      fallback: config.layoutFallback,
      syncSurface: syncElementPixelSize
    })

    const caption: CaptionHandle = createCaptionElement({
      editor,
      getPos,
      initial: readCaption(node)
    })
    dom.append(caption.el)

    return {
      dom,
      // Caption is a nested contenteditable the node view owns; keep PM out of its events.
      stopEvent: (event: Event) => caption.el.contains(event.target as Node | null),
      destroy: () => {
        controller.destroy()
        caption.destroy()
      },
      ignoreMutation: (mutation: ViewMutationRecord) =>
        ignoreNodeViewSubtreeMutation(mutation, dom),
      update: (updatedNode: typeof node) => {
        if (updatedNode.type.name !== name) return false

        if (layoutAttrsChanged(updatedNode.attrs, attrsSnapshot)) {
          syncMediaNodeLayout({
            wrapper: dom,
            attrs: updatedNode.attrs,
            loadingHost,
            surface: media,
            fallback: config.layoutFallback,
            syncSurface: syncElementPixelSize
          })
        }

        if (!embedAttrsEqual(updatedNode.attrs, attrsSnapshot, config.elementAttrKeys)) {
          return false
        }

        caption.sync(readCaption(updatedNode))
        attrsSnapshot = updatedNode.attrs
        return true
      }
    }
  }
}

export function renderHtmlMediaHTML(
  config: HtmlMediaNodeConfig,
  options: StyleLayoutOptions,
  {
    node,
    HTMLAttributes
  }: {
    node: { attrs: Record<string, unknown> }
    HTMLAttributes: Record<string, unknown>
  }
): [string, Record<string, unknown>, [string, Record<string, unknown>]] {
  const mediaClass = `hypermultimedia--${config.tag}__content`
  const style = createStyleString(options, {
    height: parseInt(String(HTMLAttributes.height)),
    width: parseInt(String(HTMLAttributes.width)),
    float: HTMLAttributes.float as string | null | undefined,
    clear: HTMLAttributes.clear as string | undefined,
    margin: HTMLAttributes.margin as string | undefined
  })

  const htmlAttributes = pickMediaElementAttrs(node, HTMLAttributes, config.elementAttrKeys)

  // Leaf node: no content hole — a trailing `0` makes DOMSerializer throw on getHTML/copy.
  return [
    'div',
    { [`data-${config.tag}`]: '', class: mediaClass, style },
    [config.tag, mergeAttributes(htmlAttributes, { class: mediaClass, style })]
  ]
}
