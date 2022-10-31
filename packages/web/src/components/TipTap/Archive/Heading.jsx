import {
  Node,
  mergeAttributes,
  textblockTypeInputRule,
  findParentNode,
  findChildren,
  combineTransactionSteps, getChangedRanges,

} from '@tiptap/core';
import { ObjectID } from 'bson';


import { Slice, Fragment, ResolvedPos } from 'prosemirror-model';


import { Selection, Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import { GapCursor } from 'prosemirror-gapcursor';

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


const Heading = Node.create({
  name: 'heading',
  content: 'contentHeading contentWrapper*',
  group: 'block',
  defining: true,
  isolating: true,
  allowGapCursor: false,
  addOptions() {
    return {
      levels: [1, 2, 3, 4, 5, 6],
      HTMLAttributes: {},
      ancester: ""
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
    return [
      {
        tag: 'div[data-type="draggable-item"]',
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
  create() {
    console.log("create, ====")
  },
  addNodeView() {
    return ({ editor, node, getPos, HTMLAttributes, decorations, extension }) => {
      // console.log("addnoe create new HEading", node.toJSON())
      const hasLevel = this.options.levels.includes(node.attrs.level);
      const level = hasLevel
        ? node.attrs.level
        : this.options.levels[0];

      const dom = document.createElement('div')
      dom.setAttribute('class', 'headingWrapper')
      const contentWrapper = document.createElement('div')
      contentWrapper.setAttribute('class', 'contentWrapper')

      // const content = document.createElement(`h${ level }`);
      // dom.append(content);
      dom.append(contentWrapper)

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
          // console.log(this.type, "===>>>")
          if (updatedNode.type !== this.type) {
            return false;
          }
          return true;
        },
      };
    }
  },
  addCommands() {
    return {
      setAHeading: attributes => (income) => {
        const { can, chain, commands, dispatch, editor, state, tr, view, node } = income
        var _a;
        const { schema, selection, doc } = state;
        const { $from, $to, $anchor, $cursor } = selection;
        const range = $from.blockRange($to);
        if (!range) {
          return false;
        }

        // console.log({
        //   $from, $to, $anchor, range, lastLine: $to.pos, selection, state, $cursor, chain,
        //   nodeAfter: $anchor.max($to.pos),
        //   parentIndex: $anchor.node($anchor.depth - 1),
        //   parentIndex2: $anchor.index($anchor.depth - 1),
        //   parentIndex3: $anchor.node($anchor.depth - 1).content.content.slice($anchor.index($anchor.depth - 1) + 1, $anchor.node($anchor.depth - 1).childCount).find(x => x.type.name === 'heading'),
        //   cut: $anchor.node($anchor.depth - 1).copy($anchor.node($anchor.depth - 1).content.content.slice($anchor.index($anchor.depth - 1) + 1, $anchor.node($anchor.depth - 1).childCount).filter(x => x.type.name === 'heading')),
        //   depth0: $anchor.node(1),
        //   depth00: $anchor.index($anchor.depth - 1),
        //   ancester: $anchor.node(1)?.content?.content[0],
        //   dobob22: $anchor.indexAfter($anchor.depth - 1),
        //   roboo: $anchor.doc.resolve($anchor.index($anchor.depth - 1))
        // ResolvedPos: new ResolvedPos($anchor.node(1)?.content?.content[0]),
        // posAtIndex: ResolvedPos.posAtIndex($anchor.index($anchor.depth - 1), 1)
        // })
        // let newRange = $from.blockRange($to);
        // console.log(newRange, tr)

        // tr.deleteRange(range)
        // commands.liftEmptyBlock()
        // console.log("beforeDepth", $anchor.depth)
        // console.log(tr.lift(range, $anchor.depth - 3), $anchor.depth)

        // function wrapTr(tr, $from, $to, nodeType, attrs) {
        //   let range = $from.blockRange($to), wrapping = range
        //   return wrapping ? tr.wrap(range, wrapping) : false
        // }

        // console.log(tr)

        // console.log(wrapTr(tr, $from, $to, this.name))

        // console.log(commands, selection)
        // console.log(commands.wrapIn(this.type))
        // console.log(tr.wrap(range, this.name))
        // console.log(new NodeRange())

        // commands.sinkListItem(this.name)
        // return;

        console.log({
          $anchor,
          depth0: $anchor.node(1),
          end: $anchor.end(1),
          cut: $anchor.node($anchor.depth - 1).copy($anchor.node($anchor.depth - 1).content.content.slice($anchor.index($anchor.depth - 1) + 1, $anchor.node($anchor.depth - 1).childCount).filter(x => x.type.name === 'heading')),
        })


        chain().insertContentAt($anchor.end(1) + 1, "Helo Man")


        const comingHeadingLevel = attributes.level
        const slice = state.doc.slice(range.start, range.end);
        const closestHeading = $anchor.path.filter(x => x?.type?.name).findLast(x => x.type.name === 'heading')

        const parentHeadingLevel = closestHeading?.content?.content[0].attrs.level || 0

        const currentContentWrapper = $anchor.node($anchor.depth - 1); // Node
        const currentCursorIndexInDepth = $anchor.index($anchor.depth - 1); // Number
        const nextHeadingNode = currentContentWrapper.content.content.slice(currentCursorIndexInDepth + 1, currentContentWrapper.childCount).find(x => x.type.name === 'heading')
        const nextHeadingLevel = nextHeadingNode?.content?.content[0].attrs.level || 0
        console.log("nextHeadingNode111", nextHeadingNode, $anchor.node($anchor.depth - 3))
        // const nodeAncecter = $anchor.index($anchor.depth - 1)?.content?.content[0]


        // find Ancester





        // console.log('closestHeading', closestHeading, "===>1", closestHeading.content.content[0].attrs)
        // console.log("find Parent", $anchor.path.filter(x => x?.type?.name).map(x => x.type), "=-=-=", attributes)

        console.log("$anchor.path ->", $anchor.max($to.pos).path.map(x => x?.type?.name), node)

        console.log("closestHeading=>", closestHeading)

        // console.log("222", $anchor.parent.type.name)
        // TODO: If the Heading Level change, all content below must be rerender
        // if ($anchor.parent.type.name === 'contentHeading') {
        //   console.log("changing heading header level", attributes)
        //   // mergeAttributes(this.options.HTMLAttributes, attributes)
        //   // commands.updateAttributes('heading', { ...attributes })
        //   return commands.setNode('contentHeading', attributes);
        // }


        const content = ((_a = slice.toJSON()) === null || _a === void 0 ? void 0 : _a.content) || [];


        console.log("decide for new heading", parentHeadingLevel, 'coming level', comingHeadingLevel, parentHeadingLevel > comingHeadingLevel)
        console.log("parentHeadingLevel", parentHeadingLevel, "nextHeadingLevel", nextHeadingLevel, "comingHeadingLevel", comingHeadingLevel, "===>:::", comingHeadingLevel > nextHeadingLevel)




        // sibling level
        if (parentHeadingLevel === comingHeadingLevel) {
          console.log("sibling level insert")
          return chain()
            .insertContentAt(range.end + 1, {
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
            .setTextSelection(range.start + 2)
            .run();
        }

        // child level
        // But What if for this senario h1 h2 (h3) h2
        if (parentHeadingLevel < comingHeadingLevel) {
          console.log("child Level Insert", comingHeadingLevel, nextHeadingLevel)
          // break the wrapper
          if (comingHeadingLevel < nextHeadingLevel) {
            console.log("yes break the wrapper")
            // find the heading nodes and cut theme and past to the end of the current heading
            const restNodes = $anchor.node($anchor.depth - 1).copy($anchor.node($anchor.depth - 1).content.content.slice($anchor.index($anchor.depth - 1) + 1, $anchor.node($anchor.depth - 1).childCount).filter(x => x.type.name === 'heading'))

            console.log($anchor.node(1).content, "=--=-=-")

            console.log("rest node to copy", restNodes, tr)
            // tr.insert($anchor.end(1) + 1, $anchor.node(1).content.content)
            tr.lift($anchor.node(1), range.start)
            // chain().insertContentAt({ from: range.start, to: range.end }, {
            //   type: this.name,
            //   content: [
            //     {
            //       type: 'contentHeading',
            //       attrs: {
            //         level: attributes.level
            //       },
            //     },
            //     {
            //       type: 'contentWrapper',
            //       content: content,
            //     },
            //   ],
            // }).setTextSelection(range.start + 2).run();

            // tr.replaceRangeWith($anchor.end(1) + 2, $anchor.end(1) + 2, restNodes.content)


            // chain().insertContentAt($anchor.end(1) + 1, $anchor.node(1).content.content).setTextSelection(range.start + 2).run();


            return;

          } else {
            return chain().insertContentAt({ from: range.start, to: range.end }, {
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
              .setTextSelection(range.start + 2)
              .run();
          }

        }

        // This is complicate,
        // first go up and find upper parent heading,
        // if there is one, this new content must be one of its childredn
        // if there is not one, create new row of heading like when level is 1
        // otherwise go up and till the first parent
        if (parentHeadingLevel < comingHeadingLevel) {

        }

        return


        // console.log(slice)
        // console.log(schema.nodes)
        // return
        // const match = schema.nodes.headingsContent.contentMatch.matchFragment(slice.content);
        // if (!match) {
        //   return false;
        // }
        // console.log(schema, selection, "1", slice.content, "=", state)
        // const content = ((_a = slice.toJSON()) === null || _a === void 0 ? void 0 : _a.content) || [];
        // console.log(content, "=-=-=->>>", this, content)
        // return chain()
        //   .insertContentAt({ from: range.start, to: range.end }, {
        //     type: this.name,
        //     content: [
        //       {
        //         type: 'contentHeading',
        //         attrs: {
        //           level: attributes.level
        //         },
        //         text: "===="
        //         // content,
        //         // "content": [
        //         //   {
        //         //     "type": "placeholder",
        //         //   }
        //         // ]
        //       },
        //       {
        //         type: 'contentWrapper',
        //         content,
        //       },
        //     ],
        //   })
        //   .setTextSelection(range.start + 2)
        //   .run();

        // if (!this.options.levels.includes(attributes.level)) {
        //   return false;
        // }
        // return commands.setNode(this.name, attributes);
      },
      toggleHeading: attributes => ({ commands }) => {
        if (!this.options.levels.includes(attributes.level)) {
          return false;
        }
        return commands.toggleNode(this.name, 'paragraph', attributes);
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
    }
    // return this.options.levels.reduce((items, level) => ({
    //   ...items,
    //   ...{
    //     [`Mod-Alt-${ level }`]: () => this.editor.commands.toggleHeading({ level }),
    //   },
    // }), {});
  },
  // addInputRules() {
  //   // return this.options.levels.map(level => {
  //   //   return textblockTypeInputRule({
  //   //     find: new RegExp(`^(#{1,${ level }})\\s$`),
  //   //     type: this.type,
  //   //     getAttributes: {
  //   //       level,
  //   //     },
  //   //   });
  //   // });
  // },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('uniqueID'),
        appendTransaction: (transactions, oldState, newState) => {
          const docChanges = transactions.some(transaction => transaction.docChanged)
            && !oldState.doc.eq(newState.doc);
          const filterTransactions = this.options.filterTransaction
            && transactions.some(tr => { var _a, _b; return !((_b = (_a = this.options).filterTransaction) === null || _b === void 0 ? void 0 : _b.call(_a, tr)); });
          if (!docChanges || filterTransactions) {
            return;
          }
          const { tr, schema, selection, doc } = newState;
          const { types, attributeName, generateID } = this.options;
          const transform = combineTransactionSteps(oldState.doc, transactions);
          const { mapping } = transform;


          const { $from, $to, $anchor, $cursor } = selection;
          const range = $from.blockRange($to);

          // console.log("transform", transform, range)

          // get changed ranges based on the old state
          const changes = getChangedRanges(transform);


          // console.log("once update========>>>>", {
          //   changes, tr, mapping, newState,
          //   "options": this.options
          // })
          // changes.forEach(({ newRange }) => {
          //   const newNodes = findChildrenInRange(newState.doc, newRange, node => {
          //     return types.includes(node.type.name);
          //   });
          //   console.log(newNodes)
          //   const newIds = newNodes
          //     .map(({ node }) => node.attrs[attributeName])
          //     .filter(id => id !== null);
          //   const duplicatedNewIds = findDuplicates(newIds);
          //   newNodes.forEach(({ node, pos }) => {
          //     var _a;
          //     // instead of checking `node.attrs[attributeName]` directly
          //     // we look at the current state of the node within `tr.doc`.
          //     // this helps to prevent adding new ids to the same node
          //     // if the node changed multiple times within one transaction
          //     const id = (_a = tr.doc.nodeAt(pos)) === null || _a === void 0 ? void 0 : _a.attrs[attributeName];
          //     if (id === null) {
          //       tr.setNodeMarkup(pos, undefined, {
          //         ...node.attrs,
          //         [attributeName]: generateID(),
          //       });
          //       return;
          //     }
          //     // check if the node doesn’t exist in the old state
          //     const { deleted } = mapping.invert().mapResult(pos);
          //     const newNode = deleted && duplicatedNewIds.includes(id);
          //     if (newNode) {
          //       tr.setNodeMarkup(pos, undefined, {
          //         ...node.attrs,
          //         [attributeName]: generateID(),
          //       });
          //     }
          //   });
          // });
          // if (!tr.steps.length) {
          //   return;
          // }
          return tr;
        }
      }),
    ]
  }
});

export { Heading, Heading as default };
