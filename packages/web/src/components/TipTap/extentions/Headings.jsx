import {
  findParentNode, findChildren, Node, mergeAttributes, defaultBlockAt, isActive,
  textblockTypeInputRule, nodeInputRule,
  textInputRule,
  wrappingInputRule

} from '@tiptap/core';
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
    || $anchor.parent.type !== schema.nodes.headingsTitle
    || !hasGapCursorExtension) {
    return false;
  }
  if (direction === 'right'
    && $anchor.parentOffset !== ($anchor.parent.nodeSize - 2)) {
    return false;
  }
  const headings = findParentNode(node => node.type === schema.nodes.headings)(selection);
  if (!headings) {
    return false;
  }
  const headingsContent = findChildren(headings.node, node => node.type === schema.nodes.headingsContent);
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

const Headings = Node.create({
  name: 'headings',
  content: 'headingsTitle headingsContent ',
  group: 'block',
  defining: true,
  isolating: true,
  draggable: true,
  allowGapCursor: false,
  addOptions() {
    return {
      persist: false,
      openClassName: 'is-open',
      HTMLAttributes: {},
      levels: [1, 2, 3, 4, 5, 6],
      open: false
    };
  },
  addAttributes() {
    if (!this.options.persist) {
      return [];
    }
    return {
      level: {
        default: 1,
        rendered: false,
      },
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
  parseHTML() {
    return [
      {
        tag: 'headings[data-type="draggable-item"]',
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'headings',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
  create() {
    console.log("create")
  },
  addNodeView() {
    return ({ editor, getPos, node, HTMLAttributes, }) => {
      const dom = document.createElement('div');

      const attributes = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': this.name,
      });
      Object.entries(attributes).forEach(([key, value]) => dom.setAttribute(key, value));
      const toggle = document.createElement('button');
      const dragBtn = document.createElement('span');
      dragBtn.id = "dragspan"
      dom.append(dragBtn);
      dom.append(toggle);
      const content = document.createElement('div');
      dom.append(content);
      const toggleHeadingsContent = () => {
        dom.classList.toggle(this.options.openClassName);
        const event = new Event('toggleHeadingsContent');
        const headingsContent = content.querySelector(':scope > div[data-type="headingsContent"]');
        headingsContent === null || headingsContent === void 0 ? void 0 : headingsContent.dispatchEvent(event);
      };
      if (node.attrs.open) {
        setTimeout(toggleHeadingsContent);
      }
      toggle.addEventListener('click', () => {
        toggleHeadingsContent();
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
              console.log("what is tr", tr, currentNode)
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
          console.log(this.type)
          if (updatedNode.type !== this.type) {
            return false;
          }
          return true;
        },
      };
    };
  },
  addCommands() {
    return {
      setHeadings: attributes => ({ state, chain }) => {
        var _a;
        const { schema, selection } = state;
        const { $from, $to } = selection;
        const range = $from.blockRange($to);
        if (!range) {
          return false;
        }
        const slice = state.doc.slice(range.start, range.end);
        const match = schema.nodes.headingsContent.contentMatch.matchFragment(slice.content);
        if (!match) {
          return false;
        }
        const content = ((_a = slice.toJSON()) === null || _a === void 0 ? void 0 : _a.content) || [];
        console.log(content, "=-=-=->>>", this, content)
        return chain()
          .insertContentAt({ from: range.start, to: range.end }, {
            type: this.name,
            content: [
              {
                type: 'headingsTitle',
                attrs: {
                  level: attributes.level
                },
                // "content": [
                //   {
                //     "type": "placeholder",
                //   }
                // ]
              },
              {
                type: 'headingsContent',
                content,
              },
            ],
          })
          .setTextSelection(range.start + 2)
          .run();
      },
      unsetHeadings: () => ({ state, chain }) => {
        const { selection, schema } = state;
        const headings = findParentNode(node => node.type === this.type)(selection);
        if (!headings) {
          return false;
        }
        const headingsTitles = findChildren(headings.node, node => node.type === schema.nodes.headingsTitle);
        const headingsContents = findChildren(headings.node, node => node.type === schema.nodes.headingsContent);
        if (!headingsTitles.length || !headingsContents.length) {
          return false;
        }
        const headingsTitle = headingsTitles[0];
        const headingsContent = headingsContents[0];
        const from = headings.pos;
        const $from = state.doc.resolve(from);
        const to = from + headings.node.nodeSize;
        const range = { from, to };
        const content = headingsContent.node.content.toJSON() || [];
        const defaultTypeForSummary = $from.parent.type.contentMatch.defaultType;
        // TODO: this may break for some custom schemas
        const summaryContent = defaultTypeForSummary === null || defaultTypeForSummary === void 0 ? void 0 : defaultTypeForSummary.create(null, headingsTitle.node.content).toJSON();
        const mergedContent = [
          summaryContent,
          ...content,
        ];
        return chain()
          .insertContentAt(range, mergedContent)
          .setTextSelection(from + 1)
          .run();
      },
    };
  },
  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { schema, selection } = this.editor.state;
        const { empty, $anchor } = selection;
        if (!empty || $anchor.parent.type !== schema.nodes.headingsTitle) {
          return false;
        }
        // for some reason safari removes the whole text content within a `<summary>`tag on backspace
        // so we have to remove the text manually
        // see: https://discuss.prosemirror.net/t/safari-backspace-bug-with-details-tag/4223
        if ($anchor.parentOffset !== 0) {
          return this.editor.commands.command(({ tr }) => {
            const from = $anchor.pos - 1;
            const to = $anchor.pos;
            tr.delete(from, to);
            return true;
          });
        }
        return this.editor.commands.unsetHeadings();
      },
      // Creates a new node below it if it is closed.
      // Otherwise inside `HeadingsContent`.
      Enter: ({ editor }) => {
        const { state, view } = editor;
        const { schema, selection } = state;
        const { $head } = selection;
        if ($head.parent.type !== schema.nodes.headingsTitle) {
          return false;
        }
        const isVisible = isNodeVisible($head.after() + 1, editor);
        const above = isVisible
          ? state.doc.nodeAt($head.after())
          : $head.node(-2);
        if (!above) {
          return false;
        }
        const after = isVisible
          ? 0
          : $head.indexAfter(-1);
        const type = defaultBlockAt(above.contentMatchAt(after));
        if (!type || !above.canReplaceWith(after, after, type)) {
          return false;
        }
        const node = type.createAndFill();
        if (!node) {
          return false;
        }
        const pos = isVisible
          ? $head.after() + 1
          : $head.after(-1);
        const tr = state.tr.replaceWith(pos, pos, node);
        const $pos = tr.doc.resolve(pos);
        const newSelection = Selection.near($pos, 1);
        tr.setSelection(newSelection);
        tr.scrollIntoView();
        view.dispatch(tr);
        return true;
      },
      // The default gapcursor implementation can’t handle hidden content, so we need to fix this.
      ArrowRight: ({ editor }) => {
        return setGapCursor(editor, 'right');
      },
      // The default gapcursor implementation can’t handle hidden content, so we need to fix this.
      ArrowDown: ({ editor }) => {
        return setGapCursor(editor, 'down');
      },
    };
  },
  addInputRules() {
    console.log(this, "=-==-=-=-3-==-3=-3-=")
    const editor = this.editor;
    return this.options.levels.map(level => {
      // this.editor.chain().focus().setHeadings({ level: level }).run()
      return nodeInputRule({
        find: new RegExp(`^(#{1,${ level }})\\s$`),
        type: {
          ...this.type, content: 'text', create: function (e, d) {
            console.log(d, "=-=-=-=-11111", this)
            editor.chain().focus().setHeadings({ level: e.level, content: '' }).run()
          }
        },
        getAttributes: {
          level,
        },
      });
    });
  },
  addProseMirrorPlugins() {
    return [
      // This plugin prevents text selections within the hidden content in `HeadingsContent`.
      // The cursor is moved to the next visible position.
      new Plugin({
        key: new PluginKey('headingsSelection'),
        appendTransaction: (transactions, oldState, newState) => {
          const { editor, type } = this;
          const selectionSet = transactions.some(transaction => transaction.selectionSet);
          if (!selectionSet
            || !oldState.selection.empty
            || !newState.selection.empty) {
            return;
          }
          const headingsIsActive = isActive(newState, type.name);
          if (!headingsIsActive) {
            return;
          }
          const { $from } = newState.selection;
          const isVisible = isNodeVisible($from.pos, editor);
          if (isVisible) {
            return;
          }
          const headings = findClosestVisibleNode($from, node => node.type === type, editor);
          if (!headings) {
            return;
          }
          const headingsTitles = findChildren(headings.node, node => node.type === newState.schema.nodes.headingsTitle);
          if (!headingsTitles.length) {
            return;
          }
          const headingsTitle = headingsTitles[0];
          const selectionDirection = oldState.selection.from < newState.selection.from
            ? 'forward'
            : 'backward';
          const correctedPosition = selectionDirection === 'forward'
            ? headings.start + headingsTitle.pos
            : headings.pos + headingsTitle.pos + headingsTitle.node.nodeSize;
          const selection = TextSelection.create(newState.doc, correctedPosition);
          const transaction = newState.tr.setSelection(selection);
          return transaction;
        },
      }),
    ];
  },
});

export { Headings, Headings as default };
