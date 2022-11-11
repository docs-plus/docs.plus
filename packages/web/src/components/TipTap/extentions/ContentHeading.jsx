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
        id: ''
      },
      levels: [1, 2, 3, 4, 5, 6],
    };
  },
  addAttributes() {
    return {
      level: {
        default: 1,
        rendered: false,
      },
      id: {
        default: '',
        rendered: false
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
      console.log("222221123123123")
    }
  },
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
