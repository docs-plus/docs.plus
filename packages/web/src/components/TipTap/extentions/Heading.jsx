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
    // console.log(node, "coming render html")
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
          nextLevel: 0
        }



        const commingLevel = attributes.level;
        const parentLevel = block.edge.start !== -1 && doc?.nodeAt(block.edge.start)?.content?.content[0]?.attrs.level

        console.log({
          block,
          doc,
          beforeLevel: block.edge.start !== -1 && doc?.nodeAt(block.edge.start)?.content?.content[0]?.attrs.level,
          afterLevel: block.edge.start !== -1 && doc?.nodeAt(block.edge.end),
          commingLevel, parentLevel,
          start, end, depth
        })

        // if (commingLevel === 1 && commingLevel === parentLevel) {
        //   console.log("in one big block just we can have one heading level 1")
        //   return;
        // }

        // same level just creat a heading
        // check if has children and then copy them as a new content
        if (commingLevel === parentLevel) {
          console.log("same level just creat a heading")

          console.log({
            main: doc.cut(start).nodeAt(depth - 1).content.toJSON(),
            dobo: doc.slice(start, block.parent.end),
            start,
            block,
            copy: doc.slice(start, block.parent.end).toJSON(),
            copy1: doc.cut($anchor.pos, block.parent.end).toJSON().content
          })

          return chain()
            .insertContentAt(block.edge.end, {
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
            // .insertContentAt($from.pos, "<p><br></p>")
            // .insertContentAt(block.edge.end + 6, doc.slice($anchor.pos, block.parent.end).toJSON().content)
            .setTextSelection(block.edge.end + 2)
            .deleteRange({ from: start + 1, to: block.edge.end })
            .run();
        }

        // insert as a child of the current heading
        if (commingLevel > parentLevel) {
          console.log("insert as a child of the current heading")

          const depthDiff = parentLevel - commingLevel
          let nextLevel = 0

          let closestHeadingPos = 0;
          let closestHeadingLevel = 0;
          let containHeading = false;
          let lastChildHeadingPos = 0
          let firstChildHeadingPos = 0


          doc.nodesBetween(start, block.parent.end, function (node, pos, parent, index) {
            // if (pos >= start) {
            //   console.log("-======>>", node, pos)
            //   data.push(node)
            // }
            if (node.type.name === "heading" && pos >= start) {
              if (!containHeading) containHeading = true;
              if (closestHeadingLevel === 0) {
                closestHeadingPos = pos
                closestHeadingLevel = node.firstChild.attrs.level
              }

              console.log({
                node,
                level: node.firstChild?.attrs?.level,
                row: node.firstChild?.attrs?.level < commingLevel,
                commingLevel,
                g: node.firstChild?.attrs?.level > commingLevel,
                e: commingLevel === node.firstChild?.attrs?.level
              })

              if (node.firstChild?.attrs?.level > commingLevel) {
                lastChildHeadingPos = pos + node.content.size
                firstChildHeadingPos = pos
              }


            }

            if (node.type.name === "heading" && pos >= start) {
              // console.log({ nodeName: node.type.name, pos, level: node.firstChild?.attrs?.level, posRO1: node.type.name === "heading", posRO2: pos >= start, posRO3: commingLevel >= node.firstChild.attrs.level })
              if (nextLevel === 0 && commingLevel < node.firstChild.attrs.level) {
                console.log("yess")
                nextLevel = pos
              }
            }
          })



          console.log({
            $anchor,
            commingLevel,
            parentLevel,
            block,
            depthDiff,
            // data1: doc.slice(start, lastOnePos).toJSON(),
            k: attributes.level,
            nextLevel,
            // lastOnePos,
            // copy: doc.slice(start, lastOnePos)?.toJSON()?.content,
            copy: doc.slice(start, lastChildHeadingPos)?.toJSON()?.content,
            containHeading,
            closestHeadingPos,
            lastChildHeadingPos,
            closestHeadingLevel,
            row: doc.slice(start, block.edge.end)?.toJSON()?.content
            // index: $from.posAtIndex(start, depth)
            // data
          })

          if (nextLevel === 0) {

            console.log("simple")

            // if containHeading === true, mean copy the entire content
            // from the selection start to end of the contentWrapper
            // otherwise decide base on the closest Heading block

            if (!containHeading) {
              console.log("copy the entire content from the selection start pos")
              return chain()
                .insertContentAt({ from: start, to: block.parent.end }, {
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
                      content: doc.slice(start, block.parent.end - 1)?.toJSON()?.content
                    },
                  ],
                })
                // .deleteRange({ from: start, to: block.parent.end })
                .setTextSelection(start)
                .run()
            }

            if (commingLevel === closestHeadingLevel) {
              console.log("the selection block contain Heading block, so find the reletive Headings and copy them into the incoming new Heading")
              return chain()
                .deleteRange({ from: start, to: closestHeadingPos })

                .insertContentAt(start, {
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
                      content: doc.slice(start, closestHeadingPos)?.toJSON()?.content
                    },
                  ],
                })
                .setTextSelection(start)
                .run()
            }

            // if comming level is grather than the closestHEadingLevel, break the heading chain
            if (commingLevel > closestHeadingLevel) {
              console.log("break the chain", "if comming level is grather than the closestHEadingLevel, break the heading chain")


              console.log({
                data: [
                  {
                    "type": "paragraph",
                    "content": [
                      {
                        "type": "text",
                        "text": ""
                      }
                    ]
                  },
                  // { type: "paragraph", content: [{ type: 'text', text: '' }] },
                  ...doc.slice(start, closestHeadingPos)?.toJSON()?.content
                ],
                start,
                closestHeadingPos
              })
              // copy from start to end of the current Heading
              return chain()
                .insertContentAt($from.end(depth - 1), doc.cut(closestHeadingPos).nodeAt(depth - 1).content.toJSON())
                .deleteRange({ from: start, to: $from.end(depth - 1) })
                .insertContentAt(start, {
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
                      content: [
                        ...doc.slice(start, closestHeadingPos)?.toJSON()?.content
                      ]
                    },
                  ],
                })
                .setTextSelection(start)


                .run()

              return
            }
          }

          // as a child, if the income level is the same level
          if (commingLevel === closestHeadingLevel) {
            console.log("the selection block contain Heading block, so find the reletive Headings and copy them into the incoming new Heading")
            return chain()
              .deleteRange({ from: start, to: closestHeadingPos })

              .insertContentAt(start, {
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
                    content: doc.slice(start, closestHeadingPos)?.toJSON()?.content
                  },
                ],
              })
              .setTextSelection(start)
              .run()
          }

          // if comming level is grather than the closestHEadingLevel, break the heading chain
          if (commingLevel > closestHeadingLevel) {
            console.log("break the chain", "if comming level is grather than the closestHEadingLevel, break the heading chain")


            console.log({
              data: [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": ""
                    }
                  ]
                },
                // { type: "paragraph", content: [{ type: 'text', text: '' }] },
                ...doc.slice(start, closestHeadingPos)?.toJSON()?.content
              ],
              start,
              closestHeadingPos
            })
            // copy from start to end of the current Heading
            return chain()
              .insertContentAt($from.end(depth - 1), doc.cut(closestHeadingPos).nodeAt(depth - 1).content.toJSON())
              .deleteRange({ from: start, to: $from.end(depth - 1) })
              .insertContentAt(start, {
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
                    content: [
                      ...doc.slice(start, closestHeadingPos)?.toJSON()?.content
                    ]
                  },
                ],
              })
              .setTextSelection(start)


              .run()

            return
          }


          console.log("not simple")

          //TODO: the problame is find the last position of the heading for copy

          // chain().insertContentAt(lastOnePos, "<p>New Dataa</p>")
          // return true;
          return chain()
            .deleteRange({ from: start, to: lastChildHeadingPos })
            .insertContentAt(start, {
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
                  content: content
                },
              ],
            })
            .insertContentAt(start + 4, doc.slice(start, lastChildHeadingPos)?.toJSON()?.content)
            .setTextSelection(start)
            .run();

          return;



          // return insertHeading(this.name, chain, start, end, content, attributes)
        }



        if (commingLevel < parentLevel) {
          console.log("break the chain, cominglevel is grether than parentLevel")

          const block = {
            parent: {
              start: $from.start(depth - 1),
              end: $from.end(depth - 1),
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
            depth,
          }
          // base on leve the heading chain must break
          // if the pos is 4 and the income is 3, this three must be just go depth -1
          // but if the pos is 4 and the income is 1, this 1 must be just inject in depth === 0

          const depthDiff = Math.abs(parentLevel - commingLevel)



          let insertAt = 3
          switch (depthDiff) {
            case 1:
              insertAt = 3
              break;
            case 2:
              insertAt = 5
              break;
            case 3:
              insertAt = 7
              break;
            case 4:
              insertAt = 9
              break;
            case 5:
              insertAt = 11
              break;

            default:
              break;
          }


          console.log({
            commingLevel,
            parentLevel,
            block,
            depthDiff,
            depth,
            end: $from.end(depth - insertAt)
          })

          insertAt = 4

          return chain()
            .insertContentAt($from.end(depth - insertAt), {
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

            .setTextSelection($from.end(depth - (insertAt)))
            .insertContentAt(start, "<p></p>", { updateSelection: false })
            .deleteRange({
              from: start, to: $from.end(depth - insertAt)
            })
            .run();

        }






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
        // console.log("down")
        return setGapCursor(editor, 'down');
      },
      Backspace: (data) => {
        const { schema, selection } = this.editor.state;
        const { empty, $anchor, $head, $from, $to } = selection;
        // const { $from, $to, $anchor, $cursor } = selection;
        const { start, end, depth } = $from.blockRange($to);

        // if backspace hit in the node that is not have any content
        if ($anchor.parentOffset !== 0) return false


        // if BackSpace in in the contentHeading, and depth is 0


        // if Backspace is in the contentWrapper
        if ($anchor.parent.type.name !== schema.nodes.contentHeading.name) {
          const contentWrapper = $anchor.doc?.nodeAt($from?.before(depth))
          if (contentWrapper?.firstChild.content.size === 0) {
            return this.editor.chain()
              .deleteNode(start)
              .insertContentAt($from.pos, "<p></p>")
              .setTextSelection($from.pos - 3)
              .run()
          }
        }

        // if Backspace is in the contentHeading
        if ($anchor.parent.type.name === schema.nodes.contentHeading.name) {
          const heading = $head.path.filter(x => x?.type?.name)
            .findLast(x => x.type.name === 'heading')
          let contentWrapper = heading.lastChild

          console.log({
            $head,
            $from,
            heading,
            start: $from.start(depth),
            data: contentWrapper.content.toJSON()
          })

          // { from: $from.start(depth) - 1, to: $from.end(depth) }
          // return false
          return this.editor.chain()
            .insertContentAt({ from: $from.start(depth) - 1, to: $from.end(depth) }, contentWrapper.content.toJSON())
            .setTextSelection(start)
            .run()
        }
      },
      Enter: ({ editor, chain }) => {
        const { state, view } = editor;
        const { schema, selection, doc, tr } = state;
        const { $head, $anchor, $from, $to } = selection;
        const { start, end, depth } = $from.blockRange($to);


        // TODO: limited just for contentHeading,contentWrapper
        if ($head.parent.type.name !== schema.nodes.contentHeading.name) {
          return false;
        }

        // if a user Enter in the contentHeading block,
        // should go to the next block, which is contentWrapper
        const parent = $head.path.filter(x => x?.type?.name)
          .findLast(x => x.type.name === this.name)




        console.log("yes new", {
          $head, state, $anchor, parent,
          content: parent.lastChild.firstChild.type.name,
          sd: Selection.near(state.doc.resolve($from.pos), 1),
          // after: $head.start(depth + 1),
          // newResolve: $head.node(depth + 1)
        })

        // FIXME: not working
        // some times the contentWrapper cleaned up, so it should be create first
        // otherwise just the cursour must move to contnetWrapper
        if (parent?.content?.content.length === 1 || parent.lastChild.firstChild.type.name === 'heading') {
          console.log("yes iminininin")
          editor.commands
            .insertContentAt($anchor.pos, {
              type: 'contentWrapper',
              content: [
                {
                  "type": "paragraph",
                  "content": [
                    {
                      "type": "text",
                      "text": " "
                    }
                  ]
                },
              ]

            })
          return true;
        }


        return editor.chain()
          .setTextSelection(end + parent.lastChild.firstChild.content.size + 2)
          .run()
        return true



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
