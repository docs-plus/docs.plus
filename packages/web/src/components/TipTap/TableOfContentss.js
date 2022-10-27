import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

// import Component from './TableOfContents'

export default Node.create({
  name: 'tableOfContents',

  group: 'block',

  atom: true,

  parseHTML() {
    return [
      {
        tag: 'toc',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['toc', mergeAttributes(HTMLAttributes)]
  },

  onCreate() {
    onBeforeCreate
    const { view, state } = this.editor;
    const { tr, doc } = state;
    const { types, attributeName, generateID } = this.options;

    if (this.editor.extensionManager.extensions.find(extension => extension.name === 'collaboration')) {
      return;
    }
    console.log({ view, state, tr, doc, types, attributeName, generateID })
  },

  addNodeView() {
    return ''
  },
  // addGlobalAttributes() {
  //   return [
  //     {
  //       types: this.options.types,
  //       attributes: {
  //         [this.options.attributeName]: {
  //           default: null,
  //           parseHTML: element => element.getAttribute(`data-${ this.options.attributeName }`),
  //           renderHTML: attributes => {
  //             if (!attributes[this.options.attributeName]) {
  //               return {};
  //             }
  //             return {
  //               [`data-${ this.options.attributeName }`]: attributes[this.options.attributeName],
  //             };
  //           },
  //         },
  //       },
  //     },
  //   ];
  // },

  // addGlobalAttributes() {
  //   return [
  //     {
  //       types: ['heading', 'paragraph'],
  //       parseHTML: element => element.getAttribute(`parent`),
  //       renderHTML: attributes => {
  //         // if (!attributes.level) {
  //         //   return {};
  //         // }
  //         return {
  //           parent: attributes.parent,
  //           style: `color: red`,
  //         };
  //       },
  //       attributes: {
  //         // id: {
  //         //   default: "id",
  //         // },
  //         style: { default: "" },
  //         parent: {
  //           default: "default"
  //         },
  //         level: {
  //           default: "default"
  //         }
  //       },
  //     },
  //   ]
  // },
})
