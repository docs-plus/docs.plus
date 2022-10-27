import { Node, mergeAttributes, findParentNode, defaultBlockAt } from '@tiptap/core';
import { Selection } from 'prosemirror-state';

const HeadingsContent = Node.create({
  name: 'contentWrapper',
  content: '(contentWrapper|heading|block)+',
  defining: true,
  selectable: false,
  isolating: false,
  draggable: false,
  addOptions() {
    return {
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
  renderHTML({ HTMLAttributes }) {
    // console.log("renderHTML")

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-type': this.name }),
      0,
    ];
  },
  addNodeView() {
    return ({ HTMLAttributes }) => {
      // console.log("rednder content")

      const dom = document.createElement('div');
      dom.setAttribute('class', 'contentWrapper')
      // const attributes = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      //   'data-type': this.name,
      //   hidden: 'hidden',
      // });
      // Object.entries(attributes).forEach(([key, value]) => dom.setAttribute(key, value));
      // dom.addEventListener('toggleHeadingsContent', () => {
      //   dom.toggleAttribute('hidden');
      // });
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
          // console.log("updateNode", updatedNode)
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
