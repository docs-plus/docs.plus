// A copy of the lowlight plugin of @tiptap/extension-code-block-lowlight 3.32.0 (src/lowlight-plugin.ts).
// The one change: mermaid blocks are drawn as diagrams, not highlighted, so a caret in one no longer
// highlights every code block in the pad again (#631). Diff it against upstream on each Tiptap upgrade.
import { findChildren, textblockTypeInputRule } from '@tiptap/core'
import { CodeBlockLowlight as BaseCodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import highlight from 'highlight.js/lib/core'
import type { createLowlight } from 'lowlight'

type Lowlight = ReturnType<typeof createLowlight>
type HastNode = { value?: string; children?: HastNode[]; properties?: { className?: string[] } }

function parseNodes(
  nodes: HastNode[],
  className: string[] = []
): { text: string; classes: string[] }[] {
  return nodes.flatMap((node) => {
    const classes = [...className, ...(node.properties?.className ?? [])]
    if (node.children) return parseNodes(node.children, classes)
    return { text: node.value ?? '', classes }
  })
}

const registered = (alias: string): boolean => Boolean(highlight.getLanguage(alias))

const isHighlighted = (name: string) => (node: ProseMirrorNode) =>
  node.type.name === name && node.attrs.language !== 'mermaid'

function getDecorations(
  doc: ProseMirrorNode,
  name: string,
  lowlight: Lowlight,
  defaultLanguage: string | null
) {
  const decorations: Decoration[] = []
  findChildren(doc, isHighlighted(name)).forEach((block) => {
    let from = block.pos + 1
    const language = block.node.attrs.language || defaultLanguage
    const known =
      language &&
      (lowlight.listLanguages().includes(language) ||
        registered(language) ||
        lowlight.registered(language))
    const tree = known
      ? lowlight.highlight(language, block.node.textContent)
      : lowlight.highlightAuto(block.node.textContent)
    parseNodes(tree.children as HastNode[]).forEach((node) => {
      const to = from + node.text.length
      if (node.classes.length)
        decorations.push(Decoration.inline(from, to, { class: node.classes.join(' ') }))
      from = to
    })
  })
  return DecorationSet.create(doc, decorations)
}

function LowlightPlugin(
  name: string,
  lowlight: Lowlight,
  defaultLanguage: string | null
): Plugin<DecorationSet> {
  const plugin: Plugin<DecorationSet> = new Plugin({
    key: new PluginKey('lowlight'),
    state: {
      init: (_, { doc }) => getDecorations(doc, name, lowlight, defaultLanguage),
      apply: (tr, decorationSet, oldState, newState) => {
        const inBlock = isHighlighted(name)
        const oldNodes = findChildren(oldState.doc, inBlock)
        const newNodes = findChildren(newState.doc, inBlock)
        // Upstream rules: the caret is in a block, a block is added or removed, or a step covers a whole block
        // (as a y-prosemirror sync can).
        const changed =
          inBlock(oldState.selection.$head.parent) ||
          inBlock(newState.selection.$head.parent) ||
          newNodes.length !== oldNodes.length ||
          tr.steps.some((step) => {
            const { from, to } = step as unknown as { from?: number; to?: number }
            return (
              from !== undefined &&
              to !== undefined &&
              oldNodes.some((node) => node.pos >= from && node.pos + node.node.nodeSize <= to)
            )
          })
        if (tr.docChanged && changed) return getDecorations(tr.doc, name, lowlight, defaultLanguage)
        return decorationSet.map(tr.mapping, tr.doc)
      }
    },
    props: {
      decorations: (state) => plugin.getState(state)
    }
  })
  return plugin
}

export const backtickInputRegex = /^```([a-zA-Z0-9_+#.-]+)?[\s\n]$/
export const tildeInputRegex = /^~~~([a-zA-Z0-9_+#.-]+)?[\s\n]$/

/** Upstream CodeBlockLowlight with the copied plugin, widened language tags, and closing-fence exit. */
export const CodeBlockLowlight = BaseCodeBlockLowlight.extend({
  addInputRules() {
    return [
      textblockTypeInputRule({
        find: backtickInputRegex,
        type: this.type,
        getAttributes: (match) => ({
          language: match[1] ? match[1].toLowerCase() : null
        })
      }),
      textblockTypeInputRule({
        find: tildeInputRegex,
        type: this.type,
        getAttributes: (match) => ({
          language: match[1] ? match[1].toLowerCase() : null
        })
      })
    ]
  },

  addKeyboardShortcuts() {
    const parentShortcuts = this.parent?.() ?? {}
    const parentEnter = parentShortcuts.Enter

    return {
      ...parentShortcuts,
      Enter: ({ editor }) => {
        const { state } = editor
        const { $from, empty } = state.selection

        if (!empty || $from.parent.type !== this.type) {
          return parentEnter?.({ editor }) ?? false
        }

        const text = $from.parent.textContent
        if ($from.parentOffset !== text.length) {
          return parentEnter?.({ editor }) ?? false
        }

        const lastNl = text.lastIndexOf('\n')
        const lineStart = lastNl === -1 ? 0 : lastNl + 1
        const lastLine = text.slice(lineStart)

        if (lastLine !== '```' && lastLine !== '~~~') {
          return parentEnter?.({ editor }) ?? false
        }

        if (lineStart === 0) {
          const paragraph = state.schema.nodes.paragraph?.create()
          if (!paragraph) return false

          return editor
            .chain()
            .command(({ tr }) => {
              const pos = $from.before()
              tr.replaceWith(pos, $from.after(), paragraph)
              tr.setSelection(TextSelection.create(tr.doc, pos + 1))
              return true
            })
            .run()
        }

        const blockStart = $from.start()
        return editor
          .chain()
          .command(({ tr }) => {
            tr.delete(blockStart + lineStart - 1, blockStart + text.length)
            return true
          })
          .exitCode()
          .run()
      }
    }
  },

  addProseMirrorPlugins() {
    const base = (this.parent?.() ?? []).filter((p) => {
      const pluginKey = p.spec.key as (PluginKey & { key?: string }) | undefined
      return !pluginKey?.key?.startsWith('lowlight$')
    })
    return [
      ...base,
      LowlightPlugin(
        this.name,
        this.options.lowlight as Lowlight,
        this.options.defaultLanguage ?? null
      )
    ]
  }
})
