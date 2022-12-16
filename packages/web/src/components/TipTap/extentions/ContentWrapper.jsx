
import { Node, mergeAttributes, findParentNode, defaultBlockAt } from '@tiptap/core';
import { Selection } from 'prosemirror-state';




function collapseSection(element) {
  // get the height of the element's inner content, regardless of its actual size
  var sectionHeight = element.scrollHeight;

  // temporarily disable all css transitions
  var elementTransition = element.style.transition;
  element.style.transition = '';

  // on the next frame (as soon as the previous style change has taken effect),
  // explicitly set the element's height to its current pixel height, so we
  // aren't transitioning out of 'auto'
  requestAnimationFrame(function () {
    element.style.height = sectionHeight + 'px';
    element.style.transition = elementTransition;

    // on the next frame (as soon as the previous style change has taken effect),
    // have the element transition to height: 0
    requestAnimationFrame(function () {
      element.style.height = 0 + 'px';
    });
  });

  // mark the section as "currently collapsed"
  element.setAttribute('data-collapsed', 'true');
}

function expandSection(element) {

  // get the height of the element's inner content, regardless of its actual size
  var sectionHeight = element.scrollHeight;

  // have the element transition to the height of its inner content
  element.style.height = sectionHeight + 'px';

  // when the next css transition finishes (which should be the one we just triggered)
  element.addEventListener('transitionend', function (e) {
    // remove this event listener so it only gets triggered once
    console.log(this.callee)
    element.removeEventListener('transitionend', expandSection);

    // remove "height" from the element's inline styles, so it can return to its initial value
    element.style.height = null;
    console.log(";l;l;;;l;l;l;l", element)
  });

  // mark the section as "currently not collapsed"
  element.setAttribute('data-collapsed', 'false');
}


function getTransitionEndEventName() {
  var transitions = {
    "transition": "transitionend",
    "OTransition": "oTransitionEnd",
    "MozTransition": "transitionend",
    "WebkitTransition": "webkitTransitionEnd"
  }
  let bodyStyle = document.body.style;
  for (let transition in transitions) {
    if (bodyStyle[transition] != undefined) {
      return transitions[transition];
    }
  }
}

// using above code we can get Transition end event name
let transitionEndEventName = getTransitionEndEventName();



function slideToggle(el) {
  // The following 2 lines are ONLY needed if you ever want to start in a 'open' state. Due to the way browsers
  // work it needs a double of this (or something like console.log(el.scrollHeight);) to prevent the render skipping
  // el.style.height = el.scrollHeight + 'px';
  // el.scrollHeight = el.scrollHeight; // Something like console.log(el.scrollHeight); also works, just something to prevent render skipping




  // if (!el.classList.contains('open')) {
  //   el.classList.add('overflow-hidden');
  //   el.classList.add('opacity-0');
  // } else {
  //   setTimeout(() => {
  //     el.classList.remove('overflow-hidden');
  //     el.classList.remove('opacity-0');
  //     el.style.height = '100%'
  //   }, 350)
  // }

  el.classList.toggle('open');
  el.style.height = el.classList.contains('open') ? el.scrollHeight + 'px' : 0;

  function callback() {
    el.removeEventListener(transitionEndEventName, callback);
    console.log("Transition finished, is open:", el.classList.contains('open'));
    if (el.classList.contains('open')) {
      el.style.height = '100%';
      // el.classList.remove('overflow-hidden')
      // el.classList.remove('invisible')

    }
    else
      el.style.height = 0;
  }

  el.addEventListener(transitionEndEventName, callback);

}

function expandElement(elem, collapseClass) {
  // debugger;
  elem.style.height = '';
  elem.style.transition = 'none';

  const startHeight = window.getComputedStyle(elem).height;

  // Remove the collapse class, and force a layout calculation to get the final height
  elem.classList.toggle(collapseClass);
  const height = window.getComputedStyle(elem).height;

  // Set the start height to begin the transition
  elem.style.height = startHeight;

  // wait until the next frame so that everything has time to update before starting the transition
  requestAnimationFrame(() => {
    elem.style.transition = '';

    requestAnimationFrame(() => {
      elem.style.height = height
    })
  })

  function callback() {
    elem.style.height = '';
    elem.classList.remove('overflow-hidden')
    elem.removeEventListener('transitionend', callback);
  }

  // Clear the saved height values after the transition
  elem.addEventListener('transitionend', callback);
}



const HeadingsContent = Node.create({
  name: 'contentWrapper',
  content: '(heading|paragraph|block)*',
  defining: true,
  selectable: false,
  isolating: true,
  draggable: false,
  allowGapCursor: false,

  addOptions() {
    return {
      persist: true,
      open: true,
      HTMLAttributes: {},
    };
  },
  parseHTML() {
    return [
      {
        tag: `div[data-type="${ this.name }"]`,
      },
    ];
  },
  addAttributes() {
    if (!this.options.persist) {
      return [];
    }
    return {
      open: {
        default: this.options.open,
        parseHTML: element => element.hasAttribute('open'),
        renderHTML: ({ open }) => {
          if (!open) {
            return {};
          }
          return { open: '' };
        },
      },

    };
  },
  renderHTML({ HTMLAttributes }) {
    // console.log("renderHTML")

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-type': this.name }),
      0,
    ];
  },
  addNodeView() {
    return ({ editor, getPos, node, HTMLAttributes }) => {

      const dom = document.createElement('div');
      dom.setAttribute('class', 'contentWrapper')
      const attrs = {
        'data-type': this.name,
      }

      if (!node.attrs.open) {
        dom.classList.add('collapsed')
        dom.classList.add('overflow-hidden')
      } else {
        dom.classList.remove('collapsed')
        dom.classList.remove('overflow-hidden')
      }

      const attributes = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, attrs);
      Object.entries(attributes).forEach(([key, value]) => dom.setAttribute(key, value));
      dom.addEventListener('toggleHeadingsContent', ({ detail }) => {

        const section = detail.el;

        // dom.toggleAttribute('hidden');
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

              console.log({
                isOpen: section.classList.contains('open'),
                attr: currentNode.attrs.open,
                scrollHeight: section.scrollHeight
              })


              section.classList.toggle('open');

              if (node.attrs.open) {
                section.classList.add('overflow-hidden');

              }

              expandElement(section, 'collapsed')


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
        contentDOM: dom,
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
  addKeyboardShortcuts() {
    return {
      Backspace: (data) => {
        const { schema, selection } = this.editor.state;
        const { empty, $anchor, $head, $from, $to } = selection;
        const { start, end, depth } = $from.blockRange($to);

        // if backspace hit in the node that not have any content
        if ($anchor.parentOffset !== 0) return false
        const contentWrapper = $anchor.doc?.nodeAt($from?.before(depth))

        // if Backspace is in the contentWrapper
        if (contentWrapper.type.name !== schema.nodes.contentHeading.name) {
          if (contentWrapper.type.name !== schema.nodes.contentWrapper.name) return
          // INFO: if the contentWrapper block has one child just change textSelection
          // Otherwise remove the current line and move the textSelection to the

          if (contentWrapper.childCount === 1) {
            return this.editor.chain()
              .setTextSelection(start - 2)
              .scrollIntoView()
              .run()
          } else {
            return this.editor.chain()
              .deleteRange({ from: start, to: end })
              .setTextSelection(start - 2)
              .scrollIntoView()
              .run()
          }

        }
      },
      // Escape node on double enter
      Enter: ({ editor }) => { },
    };
  }
});

export { HeadingsContent, HeadingsContent as default };
