import { Node, mergeAttributes, findParentNode, defaultBlockAt } from '@tiptap/core';
import { Selection } from 'prosemirror-state';

const HeadingsContent = Node.create({
  name: 'contentWrapper',
  content: '(heading|paragraph|block)+',
  defining: true,
  selectable: false,
  isolating: true,
  draggable: false,
  addOptions() {
    return {
      persist: true,
      open: true,
      HTMLAttributes: {},
    };
  },
  parseHTML() {
    return [
      {
        tag: `div[data-type="${ this.name }"]`,
      },
    ];
  },
  addAttributes() {
    if (!this.options.persist) {
      return [];
    }
    return {
      open: {
        default: this.options.open,
        parseHTML: element => element.hasAttribute('open'),
        renderHTML: ({ open }) => {
          if (!open) {
            return {};
          }
          return { open: '' };
        },
      },

    };
  },
  renderHTML({ HTMLAttributes }) {
    // console.log("renderHTML")

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-type': this.name }),
      0,
    ];
  },
  addNodeView() {
    return ({ editor, getPos, node, HTMLAttributes }) => {

      const dom = document.createElement('div');
      dom.setAttribute('class', 'contentWrapper')
      const attrs = {
        'data-type': this.name,
      }
      if (!node.attrs.open) attrs.hidden = "hidden"

      const attributes = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, attrs);
      Object.entries(attributes).forEach(([key, value]) => dom.setAttribute(key, value));
      dom.addEventListener('toggleHeadingsContent', () => {
        dom.toggleAttribute('hidden');
        if (!this.options.persist) {
          editor.commands.focus();
          return;
        }
        if (editor.isEditable && typeof getPos === 'function') {
          editor
            .chain()
            .focus()
            .command(({ tr }) => {
              const pos = getPos();
              const currentNode = tr.doc.nodeAt(pos);
              if ((currentNode === null || currentNode === void 0 ? void 0 : currentNode.type) !== this.type) {
                return false;
              }
              console.log("yepyep", currentNode.attrs.open)
              tr.setNodeMarkup(pos, undefined, {
                open: !currentNode.attrs.open,
              });
              return true;
            })
            .run();
        }
      });
      return {
        dom,
        contentDOM: dom,
        ignoreMutation(mutation) {
          if (mutation.type === 'selection') {
            return false;
          }
          return !dom.contains(mutation.target) || dom === mutation.target;
        },
        update: updatedNode => {
          if (updatedNode.type !== this.type) {
            return false;
          }
          return true;
        },
      };
    };
  },
  addKeyboardShortcuts() {
    return {
      Backspace: (data) => {
        const { schema, selection } = this.editor.state;
        const { empty, $anchor, $head, $from, $to } = selection;
        const { start, end, depth } = $from.blockRange($to);

        // if backspace hit in the node that not have any content
        if ($anchor.parentOffset !== 0) return false
        const contentWrapper = $anchor.doc?.nodeAt($from?.before(depth))

        // if Backspace is in the contentWrapper
        if (contentWrapper.type.name !== schema.nodes.contentHeading.name) {
          if (contentWrapper.type.name !== schema.nodes.contentWrapper.name) return
          // INFO: if the contentWrapper block has one child just change textSelection
          // Otherwise remove the current line and move the textSelection to the

          if (contentWrapper.childCount === 1) {
            return this.editor.chain()
              .setTextSelection(start - 2)
              .scrollIntoView()
              .run()
          } else {
            return this.editor.chain()
              .deleteRange({ from: start, to: end })
              .setTextSelection(start - 2)
              .scrollIntoView()
              .run()
          }

        }
      },
      // Escape node on double enter
      Enter: ({ editor }) => {
        // const { state, view } = editor;
        // const { selection } = state;
        // const { $from, empty } = selection;
        // const headingsContent = findParentNode(node => node.type === this.type)(selection);
        // if (!empty || !headingsContent || !headingsContent.node.childCount) {
        //   return false;
        // }
        // const fromIndex = $from.index(headingsContent.depth);
        // const { childCount } = headingsContent.node;
        // const isAtEnd = childCount === fromIndex + 1;
        // if (!isAtEnd) {
        //   return false;
        // }
        // const defaultChildType = headingsContent.node.type.contentMatch.defaultType;
        // const defaultChildNode = defaultChildType === null || defaultChildType === void 0 ? void 0 : defaultChildType.createAndFill();
        // if (!defaultChildNode) {
        //   return false;
        // }
        // const $childPos = state.doc.resolve(headingsContent.pos + 1);
        // const lastChildIndex = childCount - 1;
        // const lastChildNode = headingsContent.node.child(lastChildIndex);
        // const lastChildPos = $childPos.posAtIndex(lastChildIndex, headingsContent.depth);
        // const lastChildNodeIsEmpty = lastChildNode.eq(defaultChildNode);
        // if (!lastChildNodeIsEmpty) {
        //   return false;
        // }
        // // get parent of headings node
        // const above = $from.node(-3);
        // if (!above) {
        //   return false;
        // }
        // // get default node type after headings node
        // const after = $from.indexAfter(-3);
        // const type = defaultBlockAt(above.contentMatchAt(after));
        // if (!type || !above.canReplaceWith(after, after, type)) {
        //   return false;
        // }
        // const node = type.createAndFill();
        // if (!node) {
        //   return false;
        // }
        // const { tr } = state;
        // const pos = $from.after(-2);
        // tr.replaceWith(pos, pos, node);
        // const $pos = tr.doc.resolve(pos);
        // const newSelection = Selection.near($pos, 1);
        // tr.setSelection(newSelection);
        // const deleteFrom = lastChildPos;
        // const deleteTo = lastChildPos + lastChildNode.nodeSize;
        // tr.delete(deleteFrom, deleteTo);
        // tr.scrollIntoView();
        // view.dispatch(tr);
        // return true;
      },
    };
  }
});

export { HeadingsContent, HeadingsContent as default };
