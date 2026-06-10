import { type Editor, mergeAttributes, type NodeViewRendererProps } from '@tiptap/core'
import type { NodeView, ViewMutationRecord } from '@tiptap/pm/view'

import { type CaptionHandle, createCaptionElement, readCaption } from '../caption'
import {
  layoutAttrsChanged,
  parseLayoutDimensions,
  syncIframeNodeLayout,
  wrapMediaWithLoadingShell
} from '../loading'
import {
  EMBED_LAYOUT_ATTR_KEYS,
  embedAttrsEqual,
  type FullscreenIframeKitOptions,
  resolveFullscreenIframeAttributes
} from './embedKit'
import { ignoreNodeViewSubtreeMutation } from './ignoreNodeViewMutation'
import { createEmbedWrapperStyle, type StyleLayoutOptions } from './utils'

export type IframeAttrs = Record<string, unknown>

export interface IframeEmbedNodeOptions extends StyleLayoutOptions {
  HTMLAttributes: Record<string, unknown>
}

export interface IframeEmbedConfig<TOptions extends IframeEmbedNodeOptions> {
  wrapperClass: string
  dataVideoAttr: string
  renderWrapperClass: string
  embedAttrKeys: readonly string[]
  contentEditableFalse?: boolean
  buildEmbedUrl: (src: string, attrs: IframeAttrs, options: TOptions) => string | null
  /** Label in the default loading shell, e.g. "YouTube". */
  loadingProvider?: string
  resolveIframeAttributes: (
    attrs: IframeAttrs,
    options: TOptions,
    width: number,
    height: number
  ) => Record<string, string | number | boolean>
}

type FullscreenIframeEmbedConfigInput<TOptions extends IframeEmbedNodeOptions> = Pick<
  IframeEmbedConfig<TOptions>,
  | 'wrapperClass'
  | 'dataVideoAttr'
  | 'renderWrapperClass'
  | 'embedAttrKeys'
  | 'buildEmbedUrl'
  | 'contentEditableFalse'
  | 'loadingProvider'
>

export function defineFullscreenIframeEmbedConfig<
  TOptions extends IframeEmbedNodeOptions & FullscreenIframeKitOptions
>(config: FullscreenIframeEmbedConfigInput<TOptions>): IframeEmbedConfig<TOptions> {
  return {
    ...config,
    resolveIframeAttributes: (attrs, options, width, height) =>
      resolveFullscreenIframeAttributes(attrs, options, width, height)
  }
}

function writeIframeAttributes(
  iframe: HTMLIFrameElement,
  embedUrl: string,
  iframeAttrs: Record<string, string | number | boolean>
): void {
  iframe.setAttribute('src', embedUrl)

  for (const [key, value] of Object.entries(iframeAttrs)) {
    if (key === 'allowfullscreen') {
      if (value) iframe.setAttribute('allowfullscreen', '')
      else iframe.removeAttribute('allowfullscreen')
      continue
    }
    if (key === 'width' || key === 'height') continue
    iframe.setAttribute(key, String(value))
  }
}

export function createIframeEmbedNodeView<TOptions extends IframeEmbedNodeOptions>(
  config: IframeEmbedConfig<TOptions>,
  getExtension: () => { name: string; options: TOptions; editor: Editor }
) {
  return function iframeEmbedNodeView({
    node,
    HTMLAttributes,
    getPos
  }: NodeViewRendererProps): NodeView {
    const { name, options, editor } = getExtension()
    let attrsSnapshot = node.attrs
    const dom = document.createElement('div')
    const content = document.createElement('div')
    content.style.display = 'block'
    content.style.width = '100%'
    content.style.height = '100%'
    const iframe = document.createElement('iframe')

    if (config.contentEditableFalse) dom.contentEditable = 'false'
    dom.classList.add(config.wrapperClass)
    if (node.attrs.keyId) {
      dom.setAttribute('data-key-id', String(node.attrs.keyId))
    }

    const dims = parseLayoutDimensions(node.attrs)

    const src = String(HTMLAttributes.src ?? node.attrs.src ?? '')
    const embedUrl = config.buildEmbedUrl(src, node.attrs, options) ?? ''
    const resolvedAttrs = config.resolveIframeAttributes(
      node.attrs,
      options,
      dims.width,
      dims.height
    )

    writeIframeAttributes(iframe, embedUrl, resolvedAttrs)

    Object.entries(mergeAttributes(options.HTMLAttributes, { 'data-node-name': name })).forEach(
      ([key, value]) => {
        if (value !== undefined && value !== null) {
          iframe.setAttribute(key, String(value))
        }
      }
    )

    content.append(iframe)
    const { dom: loadingHost, controller } = wrapMediaWithLoadingShell(
      editor,
      {
        kind: 'embed',
        provider: config.loadingProvider,
        width: dims.width,
        height: dims.height
      },
      content,
      { bindLoad: { element: iframe } }
    )

    dom.append(loadingHost)
    syncIframeNodeLayout({ wrapper: dom, attrs: node.attrs, loadingHost, iframe, dims })

    const caption: CaptionHandle = createCaptionElement({
      editor,
      getPos,
      initial: readCaption(node)
    })
    dom.append(caption.el)

    return {
      dom,
      contentDOM: content,
      // The caption is a nested contenteditable the node view owns; PM must not
      // process its input/key/selection events or it deletes the selected node.
      stopEvent: (event: Event) => caption.el.contains(event.target as Node | null),
      destroy: () => {
        controller.destroy()
        caption.destroy()
      },
      ignoreMutation: (mutation: ViewMutationRecord) =>
        ignoreNodeViewSubtreeMutation(mutation, dom),
      update: (updatedNode: typeof node) => {
        if (updatedNode.type.name !== name) return false

        if (layoutAttrsChanged(updatedNode.attrs, attrsSnapshot, EMBED_LAYOUT_ATTR_KEYS)) {
          syncIframeNodeLayout({
            wrapper: dom,
            attrs: updatedNode.attrs,
            loadingHost,
            iframe
          })
        }

        if (!embedAttrsEqual(updatedNode.attrs, attrsSnapshot, config.embedAttrKeys)) {
          return false
        }

        caption.sync(readCaption(updatedNode))
        attrsSnapshot = updatedNode.attrs
        return true
      }
    }
  }
}

export function renderIframeEmbedHTML<TOptions extends IframeEmbedNodeOptions>(
  config: IframeEmbedConfig<TOptions>,
  options: TOptions,
  {
    node,
    HTMLAttributes
  }: {
    node: { attrs: IframeAttrs }
    HTMLAttributes: Record<string, unknown>
  }
): [string, Record<string, unknown>, [string, Record<string, unknown>]] {
  const src = String(HTMLAttributes.src ?? node.attrs.src ?? '')
  const embedUrl = config.buildEmbedUrl(src, node.attrs, options) ?? ''

  const { width, height } = parseLayoutDimensions({
    width: HTMLAttributes.width ?? node.attrs.width,
    height: HTMLAttributes.height ?? node.attrs.height
  })

  const style = createEmbedWrapperStyle({
    display: String(HTMLAttributes.display ?? node.attrs.display ?? 'block'),
    height,
    width,
    float: (HTMLAttributes.float ?? node.attrs.float) as string | null,
    clear: String(HTMLAttributes.clear ?? node.attrs.clear ?? 'none'),
    margin: String(HTMLAttributes.margin ?? node.attrs.margin ?? 'auto'),
    justifyContent: String(HTMLAttributes.justifyContent ?? node.attrs.justifyContent ?? 'start')
  })

  const iframeAttrs = config.resolveIframeAttributes(node.attrs, options, width, height)
  const { allowfullscreen, ...restIframeAttrs } = iframeAttrs

  return [
    'div',
    { [config.dataVideoAttr]: '', class: config.renderWrapperClass, style },
    [
      'iframe',
      mergeAttributes(options.HTMLAttributes, HTMLAttributes, {
        src: embedUrl,
        ...restIframeAttrs,
        ...(allowfullscreen ? { allowfullscreen: '' } : {})
      })
    ]
  ]
}
