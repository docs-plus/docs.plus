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
          nextLevel: 0,
          depth,
          lineContent: content,
          empty: {
            "type": "paragraph",
            "content": [
              {
                "type": "text",
                "text": " "
              }
            ]
          },
          paragraph: { "type": "paragraph", }
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
            main: doc.cut(start, block.parent.end).content,
            dobo: doc.slice($anchor.pos, block.parent.end).toJSON(),
            start,
            block,
            copy: doc.cut(start).nodeAt(depth - 1),
            copy1: doc.cut(start).nodeAt(depth - 1),
            commingLevel,
            parentLevel,
            test: doc.cut(start, block.edge.end).content.toJSON(),
            roborrr: doc.slice(start, block.parent.end)?.content.toJSON()[0].content,
            content: doc.slice(start, block.parent.end).toJSON().content,
            edgeContent: doc.slice(start, $anchor.end(depth - 1)).toJSON(),
            $anchor
          })
          // console.log({
          //   nextLevel,
          //   containHeading,
          //   closestHeadingPos,
          //   lastChildHeadingPos,
          //   closestHeadingLevel,
          //   content: doc.slice(start + 1, lastChildHeadingPos)?.toJSON(),
          //   contentCut: doc.cut(block.edge.end, lastChildHeadingPos)?.toJSON()[0],
          // })

          const content = doc.slice(start, block.parent.end)?.content.toJSON()[0].content
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
                  content: content
                },
              ],
            })
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
          let rowr = 0


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

              if (rowr === 0 && node.firstChild.attrs.level <= commingLevel) {
                console.log("rorororoororoo")
                rowr = pos
              }

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
            k: attributes.level,
            nextLevel,
            copy: doc.slice(start, lastChildHeadingPos)?.toJSON()?.content,
            containHeading,
            closestHeadingPos,
            lastChildHeadingPos,
            closestHeadingLevel,
          })

          // TODO: mean?
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
            // if (commingLevel > closestHeadingLevel) {
            //   console.log("break the chain", "if comming level is grather than the closestHEadingLevel, break the heading chain")
            //   console.log({
            //     data: [
            //       {
            //         "type": "paragraph",
            //         "content": [
            //           {
            //             "type": "text",
            //             "text": ""
            //           }
            //         ]
            //       },
            //       // { type: "paragraph", content: [{ type: 'text', text: '' }] },
            //       ...doc.slice(start, closestHeadingPos)?.toJSON()?.content,

            //     ],
            //     start,
            //     closestHeadingPos,
            //     level: attributes.level
            //   })
            //   const contents = doc.slice(start, closestHeadingPos)?.toJSON()?.content
            //   console.log(contents)
            //   // copy from start to end of the current Heading

            //   return chain()
            //     .insertContentAt($from.end(depth - 1), doc.cut(closestHeadingPos).nodeAt(depth - 1).content.toJSON())
            //     .deleteRange({ from: start, to: $from.end(depth - 1) })
            //     .insertContentAt(start, {
            //       type: this.name,
            //       content: [
            //         {
            //           type: 'contentHeading',
            //           attrs: {
            //             level: attributes.level
            //           },
            //         },
            //         {
            //           type: 'contentWrapper',
            //           content: [
            //             ...doc.slice(start, closestHeadingPos)?.toJSON()?.content
            //           ]
            //         },
            //       ],
            //     })
            //     .setTextSelection(start)
            //     .run()
            //   // return chain()
            //   //   // append to the end of current depth
            //   //   .insertContentAt($from.end(depth - 1), doc.cut(closestHeadingPos).nodeAt(depth - 1).content.toJSON())
            //   //   .insertContentAt({ from: start, to: block.edge.end }, {
            //   //     type: this.name,
            //   //     content: [
            //   //       {
            //   //         type: 'contentHeading',
            //   //         attrs: {
            //   //           level: attributes.level
            //   //         },
            //   //       },
            //   //       {
            //   //         type: 'contentWrapper',
            //   //         content: contents
            //   //       },
            //   //     ],
            //   //   })
            //   //   .setTextSelection(start)
            //   //   .run()

            //   return
            // }
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
            // return chain()
            //   .insertContentAt($from.end(depth - 1), doc.cut(closestHeadingPos).nodeAt(depth - 1).content.toJSON())
            //   .deleteRange({ from: start, to: $from.end(depth - 1) })
            //   .insertContentAt(start, {
            //     type: this.name,
            //     content: [
            //       {
            //         type: 'contentHeading',
            //         attrs: {
            //           level: attributes.level
            //         },
            //       },
            //       {
            //         type: 'contentWrapper',
            //         content: doc.slice(start, closestHeadingPos)?.toJSON()?.content

            //       },
            //     ],
            //   })
            //   .setTextSelection(start)
            //   .run()

            return
          }

          if (commingLevel > parentLevel && commingLevel < closestHeadingLevel) {
            console.log("commingLevel > parentLevel && commingLevel < closestHeadingLevel")
            // copy entire data to the end and put them to comming level
            console.log({
              row: doc.cut(start, rowr)?.content.toJSON(),
              dat1: doc.cut(start, rowr)?.content.toJSON()[0].content[0].content,
              dat2: doc.slice(start, rowr)?.content.toJSON(),
              rowr
            })
            const dataContent = doc.slice(start, rowr)?.content.toJSON()
            return chain()
              // .deleteRange({ from: start, to: block.parent.end })
              .insertContentAt({ from: start, to: rowr }, {
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
                    content: dataContent
                  },
                ],
              })
              .setTextSelection(start)
              .run();
            // const dataContent = doc.slice(start, block.parent.end)?.content.toJSON()[0].content
            // return chain()
            //   // .deleteRange({ from: start, to: block.parent.end })
            //   .insertContentAt({ from: start, to: block.parent.end }, {
            //     type: this.name,
            //     content: [
            //       {
            //         type: 'contentHeading',
            //         attrs: {
            //           level: attributes.level
            //         },
            //       },
            //       {
            //         type: 'contentWrapper',
            //         content: dataContent
            //       },
            //     ],
            //   })
            //   .setTextSelection(start)
            //   .run();
          }


          console.log("not simple")

          //TODO: the problame is find the last position of the heading for copy

          // chain().insertContentAt(lastOnePos, "<p>New Dataa</p>")
          // return true;
          // const dataContent = doc.slice(start, lastChildHeadingPos)?.toJSON()?.content
          // return chain()
          //   .deleteRange({ from: start, to: lastChildHeadingPos })
          //   .insertContentAt(start, {
          //     type: this.name,
          //     content: [
          //       {
          //         type: 'contentHeading',
          //         attrs: {
          //           level: attributes.level
          //         },
          //       },
          //       {
          //         type: 'contentWrapper',
          //         content: dataContent
          //       },
          //     ],
          //   })
          //   .setTextSelection(start)
          //   .run();

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
            // .insertContentAt(block.edge.end + 6, doc.slice($anchor.pos, block.parent.end).toJSON().content)
            .setTextSelection(block.edge.end + 2)
            .insertContentAt($from.pos, "<p></p>")
            .deleteRange({ from: start + 1, to: block.edge.end })
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
            insertAt,

          })


          // coming level 1 = depth 2   if 1 => depth 0
          // coming level 2 = depth 4   if 1 => depth 2
          // coming level 3 = depth 6   if 1 => depth 4
          // coming level 4 = depth 8   if 1 => depth 6
          // coming level 5 = depth 10  if 1 => depth 8
          // coming level 6 = depth 12  if 1 => depth 10

          let newDepth = 0

          switch (commingLevel) {
            case 1:
              newDepth = 0
              break;
            case 2:
              newDepth = 2
              break;
            case 3:
              newDepth = 4
              break;
            case 4:
              newDepth = 6
              break;
            case 5:
              newDepth = 8
              break;
            case 6:
              newDepth = 10
              break;

            default:
              break;
          }



          // newDepth = 6

          console.log("newDepth", {
            newDepth,
            // d: $from.nodeAt($from.end(newDepth - 1)),
            depth,
            from: $from,
            index: $from.index(newDepth),
            after: $from.indexAfter(newDepth),
            // posAt: $from.posAtIndex($from.indexAfter(newDepth), newDepth),
            // posAt2: $from.posAtIndex(start, depth),
            parentLevel,
            commingLevel,
            attributes
          })



          let posAt = $from.posAtIndex($from.indexAfter(newDepth), newDepth)
          if (commingLevel !== 1) {
            posAt = $from.end(newDepth)
          }

          const contents = doc.cut(start).nodeAt(depth - 1).content.toJSON()

          console.log("content =>", contents, "posAt=>", posAt)

          const data = []
          let firstHEading = true
          let flagOne = true
          let prevLevel = 0

          doc.nodesBetween(start, posAt, function (node, pos, parent, index) {

            if (node.type.name === "paragraph" && pos >= start && firstHEading) {
              console.log({
                // node,
                name: node.type.name,
                clevel: commingLevel,
                // json: node.toJSON(),
                depth,
                index
              })
              data.push(node.toJSON())
            }

            if (node.type.name === "heading" && pos >= start) {

              firstHEading = false
              if (prevLevel === 0)
                prevLevel = node.firstChild?.attrs?.level

              console.log({
                // node,
                le: node.firstChild?.attrs?.level,
                name: node.type.name,
                PL: prevLevel,
                // clevel: commingLevel,
                // json: node.toJSON(),
                // depth,
                index
              })


              if (flagOne) {
                if (index === 1) {
                  flagOne = false
                } else {
                  if (prevLevel >= node.firstChild?.attrs?.level)
                    data.push({ ...node.toJSON(), le: node.firstChild?.attrs?.level })
                }
              }

              prevLevel = node.firstChild?.attrs?.level



            }



          })

          console.log(data)


          if (commingLevel === 1) {
            console.log({
              contents,
              start, posAt,
              $from,
              index: $from.indexAfter(newDepth),
              contents1: doc.cut(start).nodeAt(1),
              contents2: doc.cut(start, block.ancesster.end).content.toJSON(),
              t: schema.nodes.contentHeading,
              dir: doc.copy(doc.cut(start).nodeAt(1).content)
            })
            return chain()

              .insertContentAt(posAt, {
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
                    content: data
                  },
                ],
              })
              .insertContentAt(start, "<p></p>")
              .setTextSelection(posAt)
              .deleteRange({
                from: start + 1, to: posAt
              })
              .run()
          }







          return chain()
            .insertContentAt(posAt, {
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
                  content: contents
                },
              ],
            })
            .insertContentAt(start, block.paragraph, { updateSelection: false })
            .setTextSelection(posAt)
            .deleteRange({
              from: start + 1, to: block.edge.end
            })
            .insertContentAt(start, block.paragraph, { updateSelection: false })
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

        // if Backspace is in the contentWrapper, and the cursour is in the first child
        // of the block with parentOffset

        // if ($anchor.parentOffset > 0)
        console.log({
          $anchor,
          start,
        })

        // if backspace hit in the node that is not have any content
        if ($anchor.parentOffset !== 0) return false




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
          // TODO: use delete note is better, if there is no content in contetnWrapper block
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


        // TODO: limited just for contentHeading,contentWrapper
        if ($head.parent.type.name !== schema.nodes.contentHeading.name) {
          return false;
        }

        const { start, end, depth } = $from.blockRange($to);


        // if a user Enter in the contentHeading block,
        // should go to the next block, which is contentWrapper
        const parent = $head.path.filter(x => x?.type?.name)
          .findLast(x => x.type.name === this.name)


        console.log("yes new", {
          $head, state, $anchor, parent,
          content: parent?.lastChild?.firstChild?.type.name,
          sd: Selection.near(state.doc.resolve($from.pos), 1),
          // after: $head.start(depth + 1),
          // newResolve: $head.node(depth + 1)
        })

        // FIXME: not working
        // some times the contentWrapper cleaned up, so it should be create first
        // otherwise just the cursour must move to contnetWrapper
        // TODO: find better way for this 4
        if (parent?.content?.content.length === 1 || parent.lastChild.firstChild.type.name === 'heading') {
          // console.log("yes iminininin", parent.lastChild.firstChild.contentsize === 0, parent.lastChild.firstChild)
          //If there is not any contentWrapper
          console.log(parent.lastChild)
          // if first child of the heading is another heading
          console.log(parent.lastChild.type.name === "contentWrapper")
          console.log(parent.lastChild.content.lastChild.type.name === "heading")
          // if the contentWrapper does not contain any content
          // or if
          if (parent.lastChild.content.size === 0 || parent.lastChild?.firstChild?.content.size === 0) {
            return editor.commands.insertContentAt($anchor.pos, {
              type: 'contentWrapper',
              content: [
                {
                  "type": "paragraph"
                },
              ]

            })

          }
          console.log("move to contetnWrapper", {
            after: $anchor.after(depth + 1),
            start,
            start1: $anchor.start(depth + 2) + 1
          })
          // move to contentWrapper
          editor.commands
            .insertContentAt($anchor.start(depth + 2) + 1, "<p></p>")
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
