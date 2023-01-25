import { Node, mergeAttributes, wrappingInputRule, findParentNode, findChildren, isActive, textblockTypeInputRule } from '@tiptap/core';
import { Slice, Fragment, NodeRange, NodeType, Mark, ContentMatch, DOMSerializer } from "prosemirror-model"
import { Selection, Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import { Transform } from 'prosemirror-transform'
import changeHeadingLevel from './changeHeadingLevel';
import wrapContenWithHeading from './wrapContenWithHeading';
import clipboardPast from './clipboardPast';
import changeHeading2paragraphs from './changeHeading2paragraphs';

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



const inputRegex = /(?:^|\s)((?:~)((?:[^~]+))(?:~))/g;
const Blockquote = Node.create({
  name: 'heading',
  content: 'contentHeading+ contentWrapper*',
  group: 'contentWrapper',
  defining: true,
  isolating: true,
  allowGapCursor: false,
  addOptions() {
    return {
      levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      persist: false,
      openClassName: 'is-open',
      HTMLAttributes: {
        class: "heading",
        level: 1
      },
    };
  },
  addAttributes() {
    if (!this.options.persist) {
      return [];
    }
    return {
      open: {
        default: true,
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
        'level': node.firstChild?.attrs.level
      });
      Object.entries(attributes).forEach(([key, value]) => dom.setAttribute(key, value));

      const headingId = HTMLAttributes['data-id']

      if (node.attrs.open) {
        dom.classList.add(this.options.openClassName)
      } else {
        dom.classList.remove(this.options.openClassName)
      }

      const foldEl = document.createElement('div')
      foldEl.classList.add('foldWrapper')

      for (let i = 0; i <= 3; i++) {
        const line = document.createElement('div')
        line.classList.add(`fold`)
        line.classList.add(`l${ i }`)
        foldEl.append(line)
      }

      dom.append(foldEl)

      foldEl.addEventListener('click', () => {
        document.querySelector(`.title[data-id="${ headingId }"] .btnFold`).click()
      });

      const content = document.createElement('div')
      content.classList.add('wrapBlock')
      content.setAttribute('data-id', headingId)
      dom.append(content);


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
          if (updatedNode.attrs?.open) {
            dom.classList.add(this.options.openClassName)
          } else {
            dom.classList.remove(this.options.openClassName)
          }
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
      normalText: () => (arrg) => {
        return changeHeading2paragraphs(arrg)
      },
      wrapBlock: (attributes) => (arrg) => {
        const { can, chain, commands, dispatch, editor, state, tr, view } = arrg
        const { schema, selection, doc } = state;
        const { $from, $to, $anchor, $cursor } = selection;

        // TODO: change heading level
        // First get the content of heading
        // then copy the contentWrapper of the heading
        if ($anchor.parent.type.name === schema.nodes.contentHeading.name) {
          return changeHeadingLevel(arrg, attributes, dispatch)
        }

        return wrapContenWithHeading(arrg, attributes, dispatch)
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
      Backspace: (data) => { },
      Enter: ({ editor, chain }) => {
        const { state, view } = editor;
        const { schema, selection, doc, tr } = state;
        const { $head, $anchor, $from, $to } = selection;

        // if ($head.parent.type.name !== schema.nodes.heading.name) return false;

        // TODO: limited just for contentHeading, contentWrapper
        if ($head.parent.type.name !== schema.nodes.contentHeading.name) {
          return false;
        }



        const { start, end, depth } = $from.blockRange($to);


        // if a user Enter in the contentHeading block,
        // should go to the next block, which is contentWrapper
        const parent = $head.path.filter(x => x?.type?.name)
          .findLast(x => x.type.name === this.name)

        console.log({
          s: $head.parent.type.name,
          open: parent.attrs.open
        })

        // INFO: if the content is hide, do not anything
        // ! this open in the Heading block is wrong and Have to change, It's opposite
        if (parent.attrs.open) return false

        console.log("yes new", {
          $head, state, $anchor, parent,
          content: parent?.lastChild?.firstChild?.type.name,
          sd: Selection.near(state.doc.resolve($from.pos), 1),
          // after: $head.start(depth + 1),
          // newResolve: $head.node(depth + 1)
          isHeading: parent
        })

        // FIXME: not working
        // some times the contentWrapper cleaned up, so it should be create first
        // otherwise just the cursour must move to contnetWrapper
        // TODO: find better way for this 4
        if (parent?.content?.content.length === 1 || parent.lastChild?.firstChild?.type.name === 'heading') {
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
          transformPastedHTML: (html, event) => {
            // INFO: Div turn confuses the schema service;
            // INFO:if there is a div in the clipboard, the docsplus schema will not serialize as a must.
            html = html.replace(/div/g, 'span')

            return html
          },
          transformPasted: (slice) => {
            return clipboardPast(slice, this.editor)
          },
          transformCopied: (slice, view) => {
            // Can be used to transform copied or cut content before it is serialized to the clipboard.
            const { schema, selection, doc } = this.editor.state;
            const { empty, $anchor, $head, $from, $to } = selection;
            const { start, end, depth } = $from.blockRange($to);
            console.log("transformCopied", { slice })

            const contentWrapper = []
            let firstHEading = true
            let prevDepth = 0
            doc.nodesBetween(start, end, function (node, pos, parent, index) {
              if (pos < start) return
              if (firstHEading && node.type.name !== 'heading' && parent.type.name === 'contentWrapper') {
                const depth = doc.resolve(pos).depth
                contentWrapper.push({ depth, startBlockPos: pos, parent, index, endBlockPos: pos + node.nodeSize, ...node.toJSON(), })
              }
              if (node.type.name === "heading") {
                firstHEading = false
                const headingLevel = node.firstChild?.attrs?.level
                const depth = doc.resolve(pos).depth
                if (prevDepth === 0) prevDepth = depth

                if (prevDepth >= depth) {
                  contentWrapper.push({ le: headingLevel, depth, index, startBlockPos: pos, endBlockPos: pos + node.nodeSize, ...node.toJSON(), })
                  prevDepth = depth
                }
              }
            })

            let mapHeadingIndex = []
            let serializedSelection = [];

            const departHeading = (headingBlock) => {
              const newBlocks = []
              const htag = headingBlock.content.find(x => x.type === 'contentHeading')
              const restOfContnets = headingBlock.content.find(x => x.type === 'contentWrapper')
              newBlocks.push(htag)
              newBlocks.push(...restOfContnets.content)
              return newBlocks
            }

            const createRemainHeadingMap = (contentWrapper) => {
              const hMap = []
              for (const [index, block] of contentWrapper.entries()) {
                if (block.type === 'heading') {
                  hMap.push({ index, block })
                }
              }
              return hMap
            }

            const departContents = (contents) => {

              mapHeadingIndex = createRemainHeadingMap(contents)

              if (mapHeadingIndex.length < 0) return serializedSelection = contents

              for (let blockHeading of mapHeadingIndex) {
                const newContents = departHeading(blockHeading.block)
                contents.splice(blockHeading.index, 1, newContents)
              }

              // flat the array
              contents = [].concat(...contents)

              // clreate the heading map
              mapHeadingIndex = []

              mapHeadingIndex = createRemainHeadingMap(contents)

              // If the heading block is left, Re-serialize contents
              if (mapHeadingIndex.length > 0) return departContents(contents)

              return serializedSelection = contents
            }

            departContents(contentWrapper)

            // convert Json Block to Node Block
            serializedSelection = serializedSelection.map(x => this.editor.state.schema.nodeFromJSON(x))

            // convert Node Block to Fragment
            serializedSelection = Fragment.fromArray(serializedSelection)

            // convert Fragment to Slice and save it to clipboard
            return Slice.maxOpen(serializedSelection)
          }
        }
      })
    ];
  },
});

export { Blockquote, Blockquote as default };
