import { Node, mergeAttributes } from '@tiptap/core';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view'
import { ObjectID } from 'bson';

import { Plugin } from 'prosemirror-state';
import joinH1ToPrevHeading from './joinH1ToPrevHeading';

const HeadingsTitle = Node.create({
  name: 'contentHeading',
  content: 'text*',
  group: 'block',
  defining: true,
  draggable: false,
  selectable: false,
  isolating: true,
  allowGapCursor: false,
  addOptions() {
    return {
      HTMLAttributes: {
        class: "title",
      },
      levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    };
  },
  addAttributes() {
    return {
      level: {
        default: 1,
        rendered: false,
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
  addKeyboardShortcuts() {
    return {
      Backspace: (data) => {
        const { schema, selection, doc } = this.editor.state;
        const { empty, $anchor, $head, $from, $to } = selection;
        const { depth } = $anchor;
        // if backspace hit in the node that is not have any content
        if ($anchor.parentOffset !== 0) return false

        // TODO: if the backspace is in heading level 1
        // TODO: what if there is not parent


        // if Backspace is in the contentHeading
        if ($anchor.parent.type.name === schema.nodes.contentHeading.name) {
          const heading = $head.path.filter(x => x?.type?.name)
            .findLast(x => x.type.name === 'heading')
          let contentWrapper = heading.lastChild

          console.log({
            $anchor,
            contentWrapper,
            heading,
            parent: !$from.doc.nodeAt($from.pos - 2).attrs.open,
            r: heading.lastChild?.attrs,
            re: Object.hasOwn(heading.lastChild?.attrs, 'open'),
            w: !$from.doc.nodeAt($from.pos - 2).attrs.open
          })

          // check if the current heading has level 1
          // then if has h1 sebling as prev block
          if ($anchor.parent.type.name === 'contentHeading' && $anchor.parent.attrs.level === 1) {
            return joinH1ToPrevHeading(this.editor)
          }


          // INFO: Prevent To Remove the Heading Block If its close.
          if (Object.hasOwn(heading.lastChild?.attrs, 'open') && !heading.lastChild?.attrs?.open) return false



          // if (heading.lastChild.type.name === heading.firstChild.type.name) {

          // }

          // INFO: CURRENT pos start, with size of first paragraph in the contentWrapper
          const block = {
            start: $from.start(depth - 1) - 1,
            end: $from.end(depth - 1)
          }

          // console.log({
          //   heading
          // })

          const selectionPos = block.start + 1 + (heading.lastChild?.firstChild?.content?.size || -1)
          console.log({
            selectionPos,
            block,
            contentWrapper,
            parent: $from.doc.nodeAt($from.start(depth) - 3)
          })


          return this.editor.chain()
            .insertContentAt(
              { from: block.start, to: block.end },
              contentWrapper.content.toJSON()
            )
            .setTextSelection(selectionPos)
            .scrollIntoView()
            .run()
        }

      }
    }
  }
});

export { HeadingsTitle, HeadingsTitle as default };
