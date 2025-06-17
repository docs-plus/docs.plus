import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { buildDecorations } from "./decoration";

export const MediaResizeGripper = Extension.create({
  name: "MediaResizeGripper",
  addOptions() {
    return {
      acceptedNodes: ["Image"],
    };
  },
  addProseMirrorPlugins() {
    const { acceptedNodes } = this.options;
    const editorView = this.editor.view;
    const editor = this.editor;

    return [
      new Plugin({
        key: new PluginKey("MediaResizeGripper"),
        state: {
          init(_, { doc }) {
            return buildDecorations(acceptedNodes, doc, editorView, editor);
          },
          apply(tr, old) {
            return tr.docChanged
              ? buildDecorations(acceptedNodes, tr.doc, editorView, editor)
              : old;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
