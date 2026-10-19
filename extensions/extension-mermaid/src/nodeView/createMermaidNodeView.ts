import { type Editor, mergeAttributes } from '@tiptap/core'
import { DOMSerializer, type Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { NodeView, NodeViewConstructor, ViewMutationRecord } from '@tiptap/pm/view'

import { MERMAID_LANGUAGE } from '../constants'
import { createRenderer } from '../renderer/createRenderer'
import type { MermaidOptions, MermaidSnapshot, MermaidView } from '../types'
import { createDefaultView } from '../view/createDefaultView'
import { element } from '../view/element'
import type { Folds, Head } from './fold'
import { observeVisible } from './observeVisible'
import { createRenderLoop, type RenderLoop } from './renderLoop'
import { applyTheme } from './theme'

class MermaidNodeView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement

  private node: ProseMirrorNode
  private readonly view: MermaidView
  private readonly head: Head
  private readonly unobserve: () => void
  private readonly loop: RenderLoop

  constructor(
    node: ProseMirrorNode,
    private readonly getPos: () => number | undefined,
    private readonly editor: Editor,
    private readonly options: MermaidOptions,
    folds: Folds
  ) {
    this.node = node

    this.dom = document.createElement('div')
    const attributes = mergeAttributes({ class: 'mermaid-diagram' }, options.HTMLAttributes)
    for (const [key, value] of Object.entries(attributes)) {
      if (value != null) this.dom.setAttribute(key, String(value))
    }
    applyTheme(this.dom, options.theme)

    const spec = DOMSerializer.renderSpec(document, node.type.spec.toDOM!(node))
    this.contentDOM = spec.contentDOM as HTMLElement
    this.contentDOM.setAttribute('spellcheck', 'false')
    this.contentDOM.setAttribute('autocapitalize', 'off')
    this.contentDOM.setAttribute('autocorrect', 'off')
    this.contentDOM.setAttribute('translate', 'no')
    const source = element('div', 'mermaid-diagram__source')
    source.append(spec.dom)

    this.head = folds.head(this.dom, node.textContent, editor.isEditable)
    this.dom.append(source)

    this.loop = createRenderLoop({
      source: node.textContent,
      createRenderer: () => createRenderer(this.view.diagram, options),
      publish: this.publish
    })
    this.view = (options.view ?? createDefaultView)({ editor, getPos, retry: this.loop.retry })
    this.dom.append(this.view.dom)
    this.view.dom.contentEditable = 'false'
    this.view.diagram.style.setProperty('overflow', 'hidden')
    this.view.diagram.style.setProperty('contain', 'paint')

    this.paint({ state: this.loop.initial, error: null, diagramType: null })

    // The node has no width yet, so Pele mounts only after the first visibility hit.
    this.unobserve = observeVisible(this.dom, this.loop.becameVisible)
  }

  update(node: ProseMirrorNode): boolean {
    if (!node.sameMarkup(this.node)) return false
    const changed = node.textContent !== this.node.textContent
    this.node = node
    if (changed) {
      this.head.setSource(node.textContent)
      this.loop.sourceChanged(node.textContent)
    }
    return true
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    // Any inline style on the frame is host or view state, not document content. A host
    // may set `--pele-*` there at runtime, as the guide shows, and that must not rebuild the block.
    if (
      mutation.type === 'attributes' &&
      mutation.target === this.dom &&
      mutation.attributeName === 'style'
    ) {
      return true
    }
    return this.view.dom.contains(mutation.target) || this.head.ignoreMutation(mutation)
  }

  stopEvent(event: Event): boolean {
    const target = event.target
    return (target instanceof Node && this.view.dom.contains(target)) || this.head.stopEvent(event)
  }

  destroy(): void {
    this.loop.destroy()
    this.unobserve()
    this.head.destroy()
    this.view.destroy?.()
  }

  private paint(snapshot: MermaidSnapshot): void {
    this.view.dom.dataset.state = snapshot.state
    this.view.update?.(snapshot)
  }

  private readonly publish = (snapshot: MermaidSnapshot, durationMs: number | null): void => {
    this.paint(snapshot)
    try {
      this.options.onStateChange?.({
        ...snapshot,
        editor: this.editor,
        getPos: this.getPos,
        durationMs
      })
    } catch (err) {
      console.error(err)
    }
  }
}

export function createMermaidNodeView(
  editor: Editor,
  options: MermaidOptions,
  folds: Folds
): NodeViewConstructor {
  return (node, _view, getPos) => {
    if (node.attrs.language !== MERMAID_LANGUAGE) return undefined as unknown as NodeView
    return new MermaidNodeView(node, getPos, editor, options, folds)
  }
}
