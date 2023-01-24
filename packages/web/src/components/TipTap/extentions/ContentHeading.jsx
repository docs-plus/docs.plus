import { Node, mergeAttributes } from '@tiptap/core';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view'
import { ObjectID } from 'bson';

import { Plugin } from 'prosemirror-state';
import joinH1ToPrevHeading from './joinH1ToPrevHeading';

function copyToClipboard(text) {
  // const content = document.createElement("<div/>")
  // content.innerHTML = text
  // const copyText = document.getElementById("content").value;
  navigator.clipboard.writeText(text).then(() => {
    // Alert the user that the action took place.
    // Nobody likes hidden stuff being done under the hood!
    alert("Copied to clipboard");
  });
}

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
      openClassName: 'is-open',
      open: true,
      HTMLAttributes: {
        class: "title",
      },
      levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    };
  },
  addAttributes() {
    return {
      open: {
        default: true,
        // parseHTML: element => element.hasAttribute('open'),
        // renderHTML: ({ open }) => {
        //   console.log("open====>?>", open)
        //   if (!open) {
        //     return {};
        //   }
        //   return { open: '' };
        // },
      },
      level: {
        default: 1,
        rendered: false,
      }
    };
  },
  addNodeView() {
    return ({ editor, getPos, node, HTMLAttributes, }) => {
      const dom = document.createElement('div');
      const attributes = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        // 'data-type': this.name,
        // 'level': node.firstChild?.attrs.level,
        // open: node.attrs.open,
      });
      Object.entries(attributes).forEach(([key, value]) => dom.setAttribute(key, value));

      if (!node.attrs.open) {
        dom.classList.add('is-open')
      } else {
        dom.classList.remove('is-open')
      }

      console.log("what is node.attrs.open", { 1: node.attrs.open, 2: node })

      // create a button
      const button = document.createElement('button');
      button.setAttribute('class', 'btn_openChatBox');
      button.setAttribute('type', 'button');
      dom.append(button);

      // fold and unfold the heading
      const toggleHeading = document.createElement('button')
      toggleHeading.contentEditable = false
      toggleHeading.classList.add('unselectable')
      toggleHeading.classList.add('btnFold')
      dom.append(toggleHeading)

      const toggleHeadingContent = (el) => {
        console.log("what", node.attrs.open)
        dom.classList.toggle(this.options.openClassName);
        const detailsContent = document.querySelector(`.title[data-id="${ HTMLAttributes['data-id'] }"] ~ div.contentWrapper`);
        const event = new CustomEvent('toggleHeadingsContent', { detail: { open: node.attrs.open, dom, el: detailsContent } });
        console.log(detailsContent)
        detailsContent === null || detailsContent === void 0 ? void 0 : detailsContent.dispatchEvent(event);
      };

      const foldAndUnfold = (e) => {
        const el = e.target
        editor.commands.focus(getPos() + node.nodeSize - 1);
        if (editor.isEditable && typeof getPos === 'function') {
          editor
            .chain()
            .focus()
            .command(({ tr }) => {
              const pos = getPos();
              const currentNode = tr.doc.nodeAt(pos);
              console.log(currentNode)
              if ((currentNode === null || currentNode === void 0 ? void 0 : currentNode.type) !== this.type) {
                return false;
              }
              tr.setNodeMarkup(pos, undefined, {
                open: !currentNode.attrs.open,
                level: currentNode.attrs.level,
              });
              // console.log(tr)
              return true;
            })
            .run();
          toggleHeadingContent(el);

        }
      }

      toggleHeading.addEventListener('click', foldAndUnfold);

      // copy the link to clipboard
      const href = document.createElement('a')
      href.classList.add('unselectable')
      href.contentEditable = false
      href.innerHTML = "#"
      href.setAttribute('href', `#${ this.options['data-id'] }`)
      href.addEventListener('click', (e) => {
        e.preventDefault()
        const url = new URL(window.location);
        url.searchParams.set('id', e.target.parentNode.getAttribute('data-id'));
        window.history.pushState({}, '', url);
        copyToClipboard(url)
        editor
          .chain()
          .focus(getPos() + node.nodeSize - 1)
          .run()
      })
      dom.append(href)

      // heaidng contnet
      const content = document.createElement(`h${ node.attrs.level }`)
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
          if (updatedNode.type !== this.type) {
            return false;
          }
          return true;
        },
      };
    }
  },
  parseHTML() {
    return [
      {
        tag: `div[data-type="${ this.name }"]`,
      },
    ];
  },
  renderHTML(state) {
    const { node, HTMLAttributes } = state
    const hasLevel = this.options.levels.includes(node.attrs.level);
    const level = hasLevel
      ? node.attrs.level
      : this.options.levels[0];
    console.log("renderHTML", this.options)
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
