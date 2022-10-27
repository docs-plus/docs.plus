import { Node, mergeAttributes, wrappingInputRule, findParentNode, findChildren } from '@tiptap/core';
import { Slice, Fragment, NodeRange, NodeType, Mark, ContentMatch } from "prosemirror-model"
import { Selection, Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import { Transform } from 'prosemirror-transform'

const isNodeVisible = (position, editor) => {
  const node = editor.view.domAtPos(position).node;
  const isOpen = node.offsetParent !== null;
  return isOpen;
};

const setGapCursor = (editor, direction) => {
  const { state, view, extensionManager } = editor;
  const { schema, selection } = state;
  const { empty, $anchor } = selection;
  const hasGapCursorExtension = !!extensionManager.extensions.find(extension => extension.name === 'gapCursor');
  if (!empty
    || $anchor.parent.type.name !== schema.nodes.contentHeading.name
    || !hasGapCursorExtension) {
    return false;
  }
  if (direction === 'right'
    && $anchor.parentOffset !== ($anchor.parent.nodeSize - 2)) {
    return false;
  }
  const headings = findParentNode(node => node.type === schema.nodes.contentHeading)(selection);
  if (!headings) {
    return false;
  }
  const headingsContent = findChildren(headings.node, node => node.type === schema.nodes.contentWrapper);
  if (!headingsContent.length) {
    return false;
  }
  const isOpen = isNodeVisible(headings.start + headingsContent[0].pos + 1, editor);
  if (isOpen) {
    return false;
  }
  const $position = state.doc.resolve(headings.pos + headings.node.nodeSize);
  const $validPosition = GapCursor.findFrom($position, 1, false);
  if (!$validPosition) {
    return false;
  }
  const { tr } = state;
  const gapCursorSelection = new GapCursor($validPosition, $validPosition);
  tr.setSelection(gapCursorSelection);
  tr.scrollIntoView();
  view.dispatch(tr);
  return true;
};


// an isolate wrapper for heading
// TODO: create a custom Lift Function
/**
 * Lift a block or block of selection
 * @param {Object} tr Transform
 * @param {Object} range NodeRange
 * @param {Number} target Depth Target in order to append the target block
 */
const LiftBlock = (nodeName, tr, range, dispatch) => {
  let { $from, $to, depth } = range

  // clone blockquote block
  const cloneCurrentBlock = $from.path
    .filter(x => x?.type?.name)
    .findLast(x => x.type.name === nodeName)

  // console.log($from.path)

  const block = {
    parent: {
      end: $from.end(depth - 1),
      start: $from.start(depth - 1),
    },
    edge: {
      end: $from.end(depth - 1) + 1,
      start: $from.start(depth - 1) - 1,
    },
    end: $from.end(depth),
    start: $from.start(depth),
    clone: cloneCurrentBlock
  }

  console.log(cloneCurrentBlock, block.edge.start, block.edge.end)

  if (dispatch) dispatch(
    tr.replaceWith(block.edge.start, block.edge.end, block.clone.content)
  )

  return block

}
const liftBlockRange = (nodeName, tr, range, dispatch) => {

}

const WrapBlock = (tr, range, target) => {
  let { $from, $to, depth } = range

}

const insertHeading = (name, chain, start, end, content, attributes) => {

  return chain().insertContentAt({ from: start, to: end }, {
    type: name,
    content: [
      {
        type: 'contentHeading',
        attrs: {
          level: attributes.level,
          HTMLAttributes: {
            class: "tilte"
          }
        },
      },
      {
        type: 'contentWrapper',
        content,
      },
    ],
  })
    .setTextSelection(start + 2)
    .run();

}

const inputRegex = /^\s*>\s$/;
const Blockquote = Node.create({
  name: 'heading',
  addOptions() {
    return {
      levels: [1, 2, 3, 4, 5, 6],
      HTMLAttributes: {
        class: "heading",
        "data-depth": 0
      },
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
  content: 'contentHeading contentWrapper*',
  group: 'block',
  defining: true,
  isolating: true,
  parseHTML() {
    return [
      { tag: 'div' },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    console.log(node, "coming render html")
    const hasLevel = this.options.levels.includes(node.attrs.level);
    const level = hasLevel
      ? node.attrs.level
      : this.options.levels[0];
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },
  addCommands() {
    return {
      liftBlock: () => (arrg) => {
        const { can, chain, commands, dispatch, editor, state, tr, view, node } = arrg
        const { schema, selection, doc } = state;
        const { $from, $to, $anchor, $cursor } = selection;
        const range = $from.blockRange($to);


        console.log($from)

        LiftBlock(this.name, tr, range, dispatch)

      },
      breakLine: () => ({ can, chain, commands, dispatch, editor, state, tr, view }) => {
        const { schema, selection, doc } = state;
        const { $from, $to, $anchor, $cursor } = selection;
        const { start, end, depth } = $from.blockRange($to);

        // clone blockquote block
        const cloneCurrentBlock = $from.path
          .filter(x => x?.type?.name)
          .findLast(x => x.type.name === this.name)


        const block = {
          parent: {
            end: $from.end(depth - 1),
            start: $from.start(depth - 1),
          },
          edge: {
            end: $from.end(depth - 1) + 1,
            start: $from.start(depth - 1) - 1,
          },
          ancesster: {
            start: $from.start(1),
            end: $from.end(1)
          },
          end: $from.end(depth),
          start: $from.start(depth),
          clone: cloneCurrentBlock,
          beforeLevel: doc?.nodeAt($from.start(depth - 1) - 1)?.content?.content[0]?.attrs.level,

        }

        // const transform = new Transform(doc)

        const slice = state.doc.slice(start, end);
        let _a;

        const content = ((_a = slice.toJSON()) === null || _a === void 0 ? void 0 : _a.content) || [];

        console.log({
          tr, block,
          doc,
          $from,
          cloneCurrentBlock,
          node: this.type.create(null, cloneCurrentBlock),
          start: block.start, end: block.edge.end,
          cut: doc.cut(start),
          mySlic: doc.slice(start, block.edge.end, false).toJSON(),
          // slice: doc.slice(start, undefined, true),
          bro: doc.type.schema.nodes.heading,
          content,
          slice,
          sd: doc.slice(start, block.edge.end, false).toJSON().content,
          chain: chain(),
          newCut: doc.cut(start).nodeAt(depth - 1),
          depth,
          row: doc.cut(start).nodeAt(depth - 1).content.toJSON()
        })




        const data = chain()
          .insertContentAt(block.ancesster.end, {
            type: this.name,
            content: [
              {
                type: 'contentHeading',
                attrs: {
                  level: 2
                },
              },
              {
                type: 'contentWrapper',
                content: doc.cut(start).nodeAt(depth - 1).content.toJSON()
              },
            ],
          })
          .setTextSelection(block.ancesster.end + 2)
          .deleteRange({ from: start, to: block.edge.end })
          .run();

        // console.log(data, "==")
        // return

        if (dispatch) dispatch(

          // console.log(tr.findWrapping(new NodeRange(block.edge.start, block.edge.end, this.type)))
          // .insert(block.ancesster.end, block.clone.content)
          // tr.delete(block.ancesster.start, $from.pos)
          // tr.insert(block.ancesster.end, this.type.create(null, doc.cut(start).nodeAt(depth - 1).content))
          // tr.insert(block.ancesster.end, doc.type.schema.nodes.heading.create(null, doc.cut(start).nodeAt(depth - 1).content))
          // .delete(start, block.edge.end)

        )

      },
      wrapBlock: (attributes) => (arrg) => {
        const { can, chain, commands, dispatch, editor, state, tr, view } = arrg
        const { schema, selection, doc } = state;
        const { $from, $to, $anchor, $cursor } = selection;
        const { start, end, depth } = $from.blockRange($to);
        const slice = state.doc.slice(start, end);
        let _a;

        const content = ((_a = slice.toJSON()) === null || _a === void 0 ? void 0 : _a.content) || [];

        const blockPos = {
          parent: {
            end: $from.end(depth - 1),
            start: $from.start(depth - 1),
          },
          edge: {
            start: $from.start(depth - 1) - 1,
            end: $from.end(depth - 1) + 1,
          },
          end: $from.end(depth),
          start: $from.start(depth),
        }

        console.log(blockPos)


        const commingLevel = attributes.level;
        const parentLevel = blockPos.edge.start !== -1 && doc?.nodeAt(blockPos.edge.start)?.content?.content[0]?.attrs.level

        console.log({
          doc,
          beforeLevel: blockPos.edge.start !== -1 && doc?.nodeAt(blockPos.edge.start)?.content?.content[0]?.attrs.level,
          afterLevel: blockPos.edge.start !== -1 && doc?.nodeAt(blockPos.edge.end),
          commingLevel, parentLevel
        })

        if (commingLevel === 1 && commingLevel === parentLevel) {
          console.log("in one big block just we can have one heading level 1")
          return;
        }


        if (commingLevel === parentLevel) {
          console.log("same level just creat a heading")
          return chain()
            .insertContentAt(blockPos.edge.end, {
              type: this.name,
              content: [
                {
                  type: 'contentHeading',
                  attrs: {
                    level: attributes.level
                  },
                },
                {
                  type: 'contentWrapper',
                  content,
                },
              ],
            })
            .setTextSelection(start + 2)
            .run();
        }

        if (commingLevel > parentLevel) {
          console.log("insert as a child of the current heading")
          return insertHeading(this.name, chain, start, end, content, attributes)
        }

        if (commingLevel < parentLevel) {
          console.log("break the chain")

          const block = {
            parent: {
              end: $from.end(depth - 1),
              start: $from.start(depth - 1),
            },
            edge: {
              end: $from.end(depth - 1) + 1,
              start: $from.start(depth - 1) - 1,
            },
            ancesster: {
              start: $from.start(1),
              end: $from.end(1)
            },
            end: $from.end(depth),
            start: $from.start(depth),
          }

          const data = chain()


            .insertContentAt(block.ancesster.end, {
              type: this.name,
              content: [
                {
                  type: 'contentHeading',
                  attrs: {
                    level: attributes.level
                  },
                },
                {
                  type: 'contentWrapper',
                  content: doc.cut(start).nodeAt(depth - 1).content.toJSON()
                },
              ],
            })
            .insertContentAt($from.pos, "<p><br></p>")
            .setTextSelection(block.ancesster.end + 2)
            .deleteRange({ from: start + 1, to: block.edge.end })
            .run();

        }




        // return chain().insertContentAt({ from: start, to: end }, {
        //   type: this.name,
        //   content: [
        //     {
        //       type: 'contentHeading',
        //       attrs: {
        //         level: attributes.level,
        //         HTMLAttributes: {
        //           class: "tilte"
        //         }
        //       },
        //     },
        //     {
        //       type: 'contentWrapper',
        //       content,
        //     },
        //   ],
        // })
        //   .setTextSelection(start + 2)
        //   .run();



        // return commands.wrapIn(this.name, attributes);
      },
      setBlockquote: () => ({ commands }) => {
        return commands.wrapIn(this.name);
      },
      toggleBlockquote: () => ({ commands }) => {
        return commands.toggleWrap(this.name);
      },
      unsetBlockquote: () => ({ commands }) => {
        return commands.lift(this.name);
      },
    };
  },
  addKeyboardShortcuts() {
    return {
      // The default gapcursor implementation can’t handle hidden content, so we need to fix this.
      ArrowRight: ({ editor }) => {
        return setGapCursor(editor, 'right');
      },
      // The default gapcursor implementation can’t handle hidden content, so we need to fix this.
      ArrowDown: ({ editor }) => {
        console.log("down")
        return setGapCursor(editor, 'down');
      },
      Enter: ({ editor, chain }) => {
        const { state, view } = editor;
        const { schema, selection, doc, tr } = state;
        const { $head, $anchor } = selection;
        // if ($head.parent.type !== schema.nodes.contentHeading) {
        //   return false;
        // }

        if ($head.parent.type.name === schema.nodes.contentHeading.name) {
          // const newSelection = Selection.near($head.pos, 1);
          console.log("yes new", $head)
          const parent = $head.path.filter(x => x?.type?.name)
            .findLast(x => x.type.name === this.name)

          const newSelection = new TextSelection(state.doc.resolve($anchor.pos + 1))
          console.log(newSelection, $anchor, parent, parent?.content?.content.length)


          tr.setSelection(newSelection);
          if (parent?.content?.content.length === 1) {
            console.log("yepyep", editor)
            editor.commands
              .insertContentAt($anchor.pos + 1, "<p></p>")
            // .setTextSelection($anchor.pos + 2)
            // .deleteRange({ from: $anchor.pos + 2, to: $anchor.pos + 2 })
            // .run();
            return true;
          } else {
            tr.replaceWith($anchor.pos, $anchor.pos + 2, [])
          }

          tr.scrollIntoView();
          view.dispatch(tr);
          return true
        }



        // const isVisible = isNodeVisible($head.after() + 1, editor);
        // const above = isVisible
        //   ? state.doc.nodeAt($head.after())
        //   : $head.node(-2);
        // if (!above) {
        //   return false;
        // }
        // const after = isVisible
        //   ? 0
        //   : $head.indexAfter(-1);
        // const type = defaultBlockAt(above.contentMatchAt(after));
        // if (!type || !above.canReplaceWith(after, after, type)) {
        //   return false;
        // }
        // const node = type.createAndFill();
        // if (!node) {
        //   return false;
        // }
        // const pos = isVisible
        //   ? $head.after() + 1
        //   : $head.after(-1);
        // const tr = state.tr.replaceWith(pos, pos, node);
        // const $pos = tr.doc.resolve(pos);
        // const newSelection = Selection.near($pos, 1);
        // tr.setSelection(newSelection);
        // tr.scrollIntoView();
        // view.dispatch(tr);
        // return true;
      },
    }
    // return this.options.levels.reduce((items, level) => ({
    //   ...items,
    //   ...{
    //     [`Mod-Alt-${ level }`]: () => this.editor.commands.toggleHeading({ level }),
    //   },
    // }), {});
  },
  addInputRules() {
    return [
      wrappingInputRule({
        find: inputRegex,
        type: this.type,
      }),
    ];
  },
});

export { Blockquote, Blockquote as default, inputRegex };
//# sourceMappingURL=tiptap-extension-blockquote.esm.js.map
