import { Node, mergeAttributes } from '@tiptap/core';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view'

import { Plugin } from 'prosemirror-state';


const HeadingsTitle = Node.create({
  name: 'headingsTitle',
  content: 'inline*',
  group: 'block',
  defining: true,
  draggable: false,
  selectable: false,
  isolating: true,
  addOptions() {
    return {
      HTMLAttributes: {
        class: "heading",
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
    };
  },
  parseHTML() {
    // console.log(this)

    return this.options.levels
      .map((level) => ({
        tag: `h${ level }`,
        attrs: { level },
      }));
  },
  renderHTML(state) {
    const { node, HTMLAttributes } = state

    // console.log(node, HTMLAttributes, state)
    const hasLevel = this.options.levels.includes(node.attrs.level);
    const level = hasLevel
      ? node.attrs.level
      : this.options.levels[0];
    return [`h${ level }`, mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },
  props: {
    decorations: ({ doc, selection }) => {
      console.log("222221123123123")
    }
  }

});

export { HeadingsTitle, HeadingsTitle as default };
