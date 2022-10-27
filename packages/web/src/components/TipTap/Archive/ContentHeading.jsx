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
  selectable: true,
  isolating: false,
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
  }

});

export { HeadingsTitle, HeadingsTitle as default };
