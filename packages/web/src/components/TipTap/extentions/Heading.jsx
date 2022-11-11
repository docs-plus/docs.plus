import { Node, mergeAttributes, wrappingInputRule, findParentNode, findChildren, isActive, textblockTypeInputRule } from '@tiptap/core';
import { Slice, Fragment, NodeRange, NodeType, Mark, ContentMatch } from "prosemirror-model"
import { Selection, Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import { Transform } from 'prosemirror-transform'


// !Three: Refactore, review the code and add more green do
// !Four: the breaking chain function must be refactor from the beging,
// this task must examin fir each depth, beacue each depth has their own conent and breaking chaine process.


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

  // const headings = findParentNode(node => node.type === schema.nodes.contentHeading)(selection);

  // const detailsSummaries = findChildren(details.node, node => node.type === newState.schema.nodes.contentHeading);


  console.log({
    name: $anchor.parent.type.name,
    $anchor,
    vewi: editor.view,
    start: $anchor.start($anchor.depth),
    end: $anchor.end($anchor.depth),
    node: $anchor.node($anchor.depth),
    after: $anchor.after($anchor.depth),
    before: $anchor.after($anchor.depth),
    index: $anchor.index($anchor.depth),
    indexAfter: $anchor.indexAfter($anchor.depth),
    max: $anchor.max(selection),
    min: $anchor.min(selection),
    // marksAcross: $anchor.marksAcross($anchor.end($anchor.depth)),
    // empty,
    // end: $anchor.before($anchor.depth - 1),
    // rroo: $anchor.doc.nodeAt($anchor.index($anchor.depth)),
    // typeName0: $anchor.doc.nodeAt($anchor.start($anchor.depth)),
    // typeName1: $anchor.doc.nodeAt($anchor.start($anchor.depth) + 1),
    // typeName2: $anchor.doc.nodeAt($anchor.start($anchor.depth) + 2),
    // ro1: editor.view.domAtPos($anchor.end($anchor.depth) + 1),
    // ro2: editor.view.domAtPos($anchor.end($anchor.depth) - 1),
    nodeDOM1: editor.view.nodeDOM($anchor.start($anchor.depth) + 1),
    nodeDOM2: editor.view.nodeDOM($anchor.start($anchor.depth) - 1),
    // json: state,
    // parent: $anchor.doc.nodeAt($anchor.end($anchor.depth) + 1).parent
  })



  if (direction === "up" && $anchor.parent.type.name === schema.nodes.contentHeading.name) {
    const pos = $anchor.before($anchor.depth - 1) - 1
    return editor.chain().setTextSelection(pos).run()
  }

  // if (direction === "down" && ($anchor.parent.type.name === "heading" || $anchor.parent.type.name === "contentWrapper" || ($anchor.parent.type.name === "paragraph" && !editor.view.nodeDOM($anchor.end($anchor.depth))))) {
  //   const pos = $anchor.after($anchor.depth)
  //   // let size = $anchor.doc.nodeAt($anchor.after($anchor.depth))?.firstChild.content.size
  //   // if (!size) size = $anchor.doc.nodeAt($anchor.after($anchor.depth) + 2)?.firstChild.content.size
  //   console.log("whjhakljshdkjhaskjh", pos)
  //   return editor.chain().setTextSelection(pos + 2).run()
  // }

  if (direction === "up") {
    return false
  }

  if (!empty
    || $anchor.parent.type.name !== schema.nodes.contentHeading.name
    || $anchor.textOffset === 0 && $anchor.doc.nodeAt($anchor.after($anchor.depth)).type.name === "heading"
    || !hasGapCursorExtension) {
    return false;
  }
  console.log("im in", direction)
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
  console.log("===>>", direction, isOpen)
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

const findClosestVisibleNode = ($pos, predicate, editor) => {
  for (let i = $pos.depth; i > 0; i -= 1) {
    const node = $pos.node(i);
    const match = predicate(node);
    const isVisible = isNodeVisible($pos.start(i), editor);
    if (match && isVisible) {
      return {
        pos: i > 0 ? $pos.before(i) : 0,
        start: $pos.start(i),
        depth: i,
        node,
      };
    }
  }
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
  content: 'contentHeading contentWrapper*',
  group: 'contentWrapper',
  defining: true,
  isolating: true,
  allowGapCursor: false,
  addOptions() {
    return {
      levels: [1, 2, 3, 4, 5, 6],
      persist: false,
      openClassName: 'is-open',
      HTMLAttributes: {
        class: "heading",
        "data-depth": 0
      },
    };
  },
  addAttributes() {
    if (!this.options.persist) {
      return [];
    }
    return {
      open: {
        default: false,
        parseHTML: element => element.hasAttribute('open'),
        renderHTML: ({ open }) => {
          if (!open) {
            return {};
          }
          return { open: '' };
        },
      },
      level: {
        default: 1,
        rendered: false,
      },
    };
  },
  addNodeView() {
    return ({ editor, getPos, node, HTMLAttributes, }) => {
      const dom = document.createElement('div');

      const attributes = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': this.name,
      });
      Object.entries(attributes).forEach(([key, value]) => dom.setAttribute(key, value));

      const toggle = document.createElement('button')
      toggle.contentEditable = false
      toggle.innerHTML = "<span>toggle</span>"
      toggle.classList.add('unselectable')
      dom.append(toggle)


      const href = document.createElement('a')
      href.classList.add('unselectable')
      href.contentEditable = false

      href.innerHTML = "#"
      dom.append(href)

      const content = document.createElement('div')
      content.classList.add('wrapBlock')
      dom.append(content);

      if (!node.attrs.open) {
        dom.classList.add(this.options.openClassName);
      } else {
        dom.classList.remove(this.options.openClassName);
      }

      const toggleHeadingContent = () => {
        console.log("what", node.attrs.open)
        dom.classList.toggle(this.options.openClassName);
        const event = new Event('toggleHeadingsContent');
        const detailsContent = content.querySelector(':scope > div.contentWrapper');
        detailsContent === null || detailsContent === void 0 ? void 0 : detailsContent.dispatchEvent(event);
      };

      href.addEventListener('click', () => {
        alert("Hooray")
        editor
          .chain()
          .focus()
          .run()
      })

      // TODO: this migth face to problem in the slow processor
      // TODO: saving open in here is not okay, because I save this open in contentWrapper also
      toggle.addEventListener('click', () => {
        toggleHeadingContent();
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
        contentDOM: content,
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
              console.log("==========>", { ss: (+commingLevel + node.firstChild.attrs.level), commingLevel, type: node.type.name, lvl: node.firstChild.attrs.level })
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
              console.log({
                level: node.firstChild.attrs.level,
                commingLevel
              })

              if (rowr === 0 && node.firstChild.attrs.level >= commingLevel) {
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
                // this 1 mean skip the toggle button depth
                .setTextSelection(start + 1)
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
                // INFO: this 1 mean skip the toggle button and move to the next depth
                .setTextSelection(start + 1)
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
              // INFO: this 1 mean skip the toggle button
              .setTextSelection(start + 1)
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
              // INFO: 1 mean skip the toggle button block
              .setTextSelection(start + 1)
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
              // dat1: doc.cut(start, rowr)?.content.toJSON()[0].content[0].content,
              // dat2: doc.slice(start, rowr)?.content.toJSON(),
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
              // Info: 1 mean skip the toggle button block
              .setTextSelection(start + 1)
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




          if (commingLevel === 1) {

            doc.nodesBetween(start, posAt, function (node, pos, parent, index) {

              if (node.type.name === "paragraph" && pos >= start && firstHEading) {

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
                  // if (index === 1) {
                  //   flagOne = false
                  // } else {
                  if (prevLevel >= node.firstChild?.attrs?.level)
                    data.push({ ...node.toJSON(), le: node.firstChild?.attrs?.level })
                  // }
                }

                prevLevel = node.firstChild?.attrs?.level
              }



            })

            console.log(data)
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

          if (commingLevel === 2) {
            console.log("coming level 2")
            doc.nodesBetween(start, posAt, function (node, pos, parent, index) {

              if (node.type.name === "paragraph" && pos >= start && firstHEading) {

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



                if (prevLevel >= node.firstChild?.attrs?.level && node.firstChild?.attrs?.level !== commingLevel)
                  data.push({ ...node.toJSON(), le: node.firstChild?.attrs?.level })


                prevLevel = node.firstChild?.attrs?.level



              }



            })
            console.log(data)

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

              .insertContentAt($from.end(newDepth + 2) + 1, {
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
              .setTextSelection($from.end(newDepth + 2) + 1)
              .deleteRange({
                from: start + 1, to: $from.end(newDepth + 2) + 1
              })
              .run()
          }

          if (commingLevel === 3) {
            console.log("coming level 3")

            let lastPosOfData = 0
            doc.nodesBetween(start, posAt, function (node, pos, parent, index) {

              if (node.type.name === "paragraph" && pos >= start && firstHEading) {
                lastPosOfData = pos + node.content.size

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
                    if (prevLevel >= node.firstChild?.attrs?.level && node.firstChild?.attrs?.level !== commingLevel) {
                      data.push({ ...node.toJSON(), le: node.firstChild?.attrs?.level })
                      lastPosOfData = pos + node.content.size
                    }
                  }
                }

              }
            })

            console.log(data)

            console.log({
              contents,
              start, posAt,
              $from,
              index: $from.indexAfter(newDepth),
              contents1: doc.cut(start).nodeAt(1),
              contents2: doc.cut(start, block.ancesster.end).content.toJSON(),
              t: schema.nodes.contentHeading,
              dir: doc.copy(doc.cut(start).nodeAt(1).content),
              lastPosOfData
            })
            // TODO:
            return chain()

              .insertContentAt($from.end(newDepth - 2), {
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
              .setTextSelection($from.end(newDepth - 2))
              .deleteRange({
                from: start + 1, to: $from.end(newDepth - 2)
              })
              .run()
          }

          if (commingLevel === 4) {
            console.log("coming level 4")
            doc.nodesBetween(start, posAt, function (node, pos, parent, index) {

              if (node.type.name === "paragraph" && pos >= start && firstHEading) {

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

                if (prevLevel >= node.firstChild?.attrs?.level && node.firstChild?.attrs?.level !== commingLevel)
                  data.push({ ...node.toJSON(), le: node.firstChild?.attrs?.level })

                prevLevel = node.firstChild?.attrs?.level
              }
            })
            console.log(data)

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

              .insertContentAt($from.end(newDepth - 2), {
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
              .setTextSelection($from.end(newDepth - 2))
              .deleteRange({
                from: start + 1, to: $from.end(newDepth - 2)
              })
              .run()
          }

          if (commingLevel === 5) {
            console.log("coming level 5")
            doc.nodesBetween(start, posAt, function (node, pos, parent, index) {

              if (node.type.name === "paragraph" && pos >= start && firstHEading) {

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

                if (prevLevel >= node.firstChild?.attrs?.level && node.firstChild?.attrs?.level !== commingLevel)
                  data.push({ ...node.toJSON(), le: node.firstChild?.attrs?.level })

                prevLevel = node.firstChild?.attrs?.level
              }
            })
            console.log(data)

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

              .insertContentAt($from.end(newDepth), {
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
              .setTextSelection($from.end(newDepth - 2))
              .deleteRange({
                from: start + 1, to: $from.end(newDepth - 2)
              })
              .run()
          }



          console.log("breack but how")
          console.log({
            $from,
            start0: start,
            index: $from.index(depth),
            posAtIndex: $from.posAtIndex($from.index(depth), newDepth),
            start: $from.start(depth - 3),
            end: $from.end(newDepth + 2) + 1,
            parentLevel,
            commingLevel
          })

          // if (commingLevel < parentLevel) {
          //   console.log("kjdkajskdjasd")
          //   return
          // }

          // copy entire content to the end and pase right after start + 1


          return chain()

            .insertContentAt($from.end(newDepth + 2) + 1, {
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
            .insertContentAt(start, block.paragraph, { updateSelection: false })

            .deleteRange({
              from: start + 1, to: $from.end(newDepth + 2) + 1
            })
            .run()


          // return chain().insertContentAt($from.end(newDepth + 2) + 1, "<p>==>sss<===</p>")

          // return chain()
          //   .insertContentAt(posAt, {
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
          //         content: contents
          //       },
          //     ],
          //   })
          //   .insertContentAt(start, block.paragraph, { updateSelection: false })
          //   .setTextSelection(posAt)
          //   .deleteRange({
          //     from: start + 1, to: block.edge.end
          //   })
          //   .insertContentAt(start, block.paragraph, { updateSelection: false })
          //   .run();

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
      // ArrowUp: ({ editor }) => {
      //   console.log("up")
      //   return setGapCursor(editor, 'up');
      // },
      // // The default gapcursor implementation can’t handle hidden content, so we need to fix this.
      // ArrowRight: ({ editor }) => {
      //   return setGapCursor(editor, 'right');
      // },
      // // The default gapcursor implementation can’t handle hidden content, so we need to fix this.
      // ArrowDown: ({ editor }) => {
      //   console.log("down")
      //   return setGapCursor(editor, 'down');
      // },
      Backspace: (data) => {
        const { schema, selection } = this.editor.state;
        const { empty, $anchor, $head, $from, $to } = selection;
        // const { $from, $to, $anchor, $cursor } = selection;
        const { start, end, depth } = $from.blockRange($to);

        // if Backspace is in the contentWrapper, and the cursour is in the first child
        // of the block with parentOffset

        // if ($anchor.parentOffset > 0)
        // console.log({
        //   $anchor,
        //   start,
        // })

        // if backspace hit in the node that is not have any content
        if ($anchor.parentOffset !== 0) return false

        // if Backspace is in the contentWrapper
        if ($anchor.parent.type.name !== schema.nodes.contentHeading.name) {
          const contentWrapper = $anchor.doc?.nodeAt($from?.before(depth))
          console.log({ contentWrapper, count: contentWrapper.childCount, $anchor })
          // INFO: if the contentWrapper block has one child just change textSelection
          // Otherwise remove the current line and move the textSelection to the
          // headingContent

          // FIXME: this logic not working, find anotherway

          // if (contentWrapper?.firstChild.content.size === 0) {
          //   if (contentWrapper.childCount === 1) {
          //     return this.editor.chain()
          //       .setTextSelection(start - 2)
          //       .scrollIntoView()
          //       .run()
          //   } else {
          //     console.log("yep yep")
          //     return this.editor.chain()
          //       .deleteNode({ from: start, to: end })
          //       // .setTextSelection($anchor.pos - 2)
          //       .scrollIntoView()
          //       .run()
          //   }
          // }

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
            data: contentWrapper.content.toJSON(),
            isOpen: heading.lastChild.attrs.open
          })

          // INFO: Prevent To Remove the Heading Block If its close.
          if (!heading.lastChild.attrs.open) return false

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


        console.log("sss", {
          name: $head.parent.type.name
        })

        // if ($head.parent.type.name !== schema.nodes.heading.name) return false;

        // TODO: limited just for contentHeading,contentWrapper
        if ($head.parent.type.name !== schema.nodes.contentHeading.name) {
          return false;
        }

        const { start, end, depth } = $from.blockRange($to);


        // if a user Enter in the contentHeading block,
        // should go to the next block, which is contentWrapper
        const parent = $head.path.filter(x => x?.type?.name)
          .findLast(x => x.type.name === this.name)

        // INFO: if the content is hide, do not anything
        // ! this open in the Heading block is wrong and Have to change, It's opposite
        if (parent.attrs.open) return false

        console.log("yes new", {
          $head, state, $anchor, parent,
          content: parent?.lastChild?.firstChild?.type.name,
          sd: Selection.near(state.doc.resolve($from.pos), 1),
          // after: $head.start(depth + 1),
          // newResolve: $head.node(depth + 1)
          isHeading: parent.lastChild.firstChild.type.name === 'heading'
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
          // console.log(parent.lastChild.type.name === "contentWrapper")
          // console.log(parent.lastChild.content.lastChild.type.name === "heading")
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


        // INFO: 1 mean start of the next line
        const nextLine = end + 1
        return editor.chain()
          .insertContentAt(nextLine, "<p></p>")
          .scrollIntoView()
          .run()



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
  // addPasteRules(data) {
  //   console.log(data, "=-=-=--")

  //   return [];
  //   return this.options.levels.map(level => {
  //     console.log(level, "=-=-=-")
  //     return textblockTypeInputRule({
  //       find: new RegExp(`^(#{1,${ level }})\\s$`),
  //       type: this.type,
  //       getAttributes: {
  //         level,
  //       },
  //     });
  //   });
  // },
  // addInputRules() {
  //   return [
  //     wrappingInputRule({
  //       find: inputRegex,
  //       type: this.type,
  //     }),
  //   ];
  // },
  addProseMirrorPlugins() {
    return [
      // This plugin prevents text selections within the hidden content in `DetailsContent`.
      // The cursor is moved to the next visible position.
      new Plugin({
        key: new PluginKey('detailsSelection'),
        appendTransaction: (transactions, oldState, newState) => {
          const { editor, type } = this;
          const selectionSet = transactions.some(transaction => transaction.selectionSet);
          if (!selectionSet
            || !oldState.selection.empty
            || !newState.selection.empty) {
            return;
          }
          const detailsIsActive = isActive(newState, type.name);
          if (!detailsIsActive) {
            return;
          }
          const { $from } = newState.selection;
          const isVisible = isNodeVisible($from.pos, editor);
          if (isVisible) {
            return;
          }
          const details = findClosestVisibleNode($from, node => node.type === type, editor);
          if (!details) {
            return;
          }
          const detailsSummaries = findChildren(details.node, node => node.type === newState.schema.nodes.contentHeading);
          if (!detailsSummaries.length) {
            return;
          }
          const detailsSummary = detailsSummaries[0];
          const selectionDirection = oldState.selection.from < newState.selection.from
            ? 'forward'
            : 'backward';
          const correctedPosition = selectionDirection === 'forward'
            ? details.start + detailsSummary.pos
            : details.pos + detailsSummary.pos + detailsSummary.node.nodeSize;
          const selection = TextSelection.create(newState.doc, correctedPosition);
          const transaction = newState.tr.setSelection(selection);
          return transaction;
        },
      }),
      // https://github.com/pageboard/pagecut/blob/bd91a17986978d560cc78642e442655f4e09ce06/src/editor.js#L234-L241
      new Plugin({
        key: new PluginKey('copy&pasteHeading'),
        props: {
          clipboardTextParser: (str, $context) => {
            console.log("clipboardTextParser", str, $context)
          },
          transformPasted: (pslice) => {
            console.log("transformPasted", pslice, pslice.toJSON())
          },
          transformCopied: (slice, view) => {
            const { schema, selection } = this.editor.state;
            const { empty, $anchor, $head, $from, $to } = selection;
            // const { $from, $to, $anchor, $cursor } = selection;
            const { start, end, depth } = $from.blockRange($to);


            console.log("transformCopied", slice.toJSON(), selection)
            return slice
          }
        }
      })

    ];
  },

});

export { Blockquote, Blockquote as default, inputRegex };
//# sourceMappingURL=tiptap-extension-blockquote.esm.js.map
