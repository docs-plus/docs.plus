import { Node, mergeAttributes } from '@tiptap/core';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view'
import { ObjectID } from 'bson';

import { Plugin } from 'prosemirror-state';


const HeadingsTitle = Node.create({
  name: 'contentHeading',
  content: 'inline*',
  group: 'block',
  defining: true,
  draggable: false,
  selectable: false,
  isolating: true,
  addOptions() {
    return {
      HTMLAttributes: {
        class: "title",
      },
      levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    };
  },
  addAttributes() {
    return {
      level: {
        default: 1,
        rendered: false,
      }
    };
  },
  parseHTML() {
    return this.options.levels
      .map((level) => ({
        tag: `h${ level }`,
        attrs: { level },
      }));
  },
  renderHTML(state) {
    const { node, HTMLAttributes } = state
    const hasLevel = this.options.levels.includes(node.attrs.level);
    const level = hasLevel
      ? node.attrs.level
      : this.options.levels[0];
    return [`h${ level }`, mergeAttributes(this.options.HTMLAttributes, { ...HTMLAttributes, level }), 0];
  },
  props: {
    decorations: ({ doc, selection }) => {
      // console.log("222221123123123")
    }
  },
  addKeyboardShortcuts() {
    return {
      Backspace: (data) => {
        const { schema, selection } = this.editor.state;
        const { empty, $anchor, $head, $from, $to } = selection;
        const { depth } = $anchor;
        // if backspace hit in the node that is not have any content
        if ($anchor.parentOffset !== 0) return false

        // TODO: if the backspace is in heading level 1
        // TODO: what if there is not parent

        // if Backspace is in the contentHeading
        if ($anchor.parent.type.name === schema.nodes.contentHeading.name) {
          const heading = $head.path.filter(x => x?.type?.name)
            .findLast(x => x.type.name === 'heading')
          let contentWrapper = heading.lastChild

          // INFO: Prevent To Remove the Heading Block If its close.
          if (!heading.lastChild.attrs.open) return false

          // INFO: CURRENT pos start, with size of first paragraph in the contentWrapper
          const block = {
            start: $from.start(depth - 1) - 1,
            end: $from.end(depth - 1)
          }

          const selectionPos = block.start + 1 + heading.lastChild.firstChild.content.size
          console.log({
            selectionPos,
            block,
            contentWrapper,
            parent: $from.doc.nodeAt($from.start(depth) - 3)
          })


          return this.editor.chain()
            // .deleteNode('heading')
            .insertContentAt(
              { from: block.start, to: block.end },
              contentWrapper.content.toJSON()
            )
            .setTextSelection(selectionPos)
            .scrollIntoView()
            .run()
        }

      }
    }
  }
  // addNodeView() {
  //   return ({ editor, getPos, node, HTMLAttributes, }) => {
  //     console.log({
  //       HTMLAttributes,
  //       node,
  //       level: node.attrs.level
  //     })
  //     const level = node.attrs.level
  //     const dom = document.createElement('div');
  //     dom.classList.add('contentHeading')

  //     const href = document.createElement('a')
  //     href.classList.add('unselectable')
  //     href.contentEditable = false
  //     href.innerHTML = "#"
  //     dom.append(href)
  //     const content = document.createElement(`h${ level }`)
  //     content.setAttribute('level', level)
  //     dom.append(content)

  //     href.addEventListener('click', () => {
  //       alert("Hooray")
  //       editor
  //         .chain()
  //         .focus()
  //         .run()
  //     })

  //     return {
  //       dom,
  //       contentDOM: content,
  //       ignoreMutation(mutation) {
  //         if (mutation.type === 'selection') {
  //           return false;
  //         }
  //         return !dom.contains(mutation.target) || dom === mutation.target;
  //       },
  //       update: updatedNode => {
  //         if (updatedNode.type !== this.type) {
  //           return false;
  //         }
  //         return true;
  //       },
  //     };
  //   }
  // }


});

export { HeadingsTitle, HeadingsTitle as default };
