import { mergeAttributes, Node, nodeInputRule } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { inputRegex, imageClickHandler } from "./helper";
import { createTooltip, generateShortId } from "../../utils/utils";
import { MediaPlacement } from "../../utils/media-placement";
import { EditorView } from "@tiptap/pm/view";

interface LayoutOptions {
  width?: number;
  height?: number;
  margin?: string;
  clear?: string;
  float?: string;
  display?: string;
}

interface NodeOptions {
  HTMLAttributes: Record<string, any>;
  modal?: ((options: MediaPlacement) => HTMLElement | void | null) | null;
}

export interface ImageOptions extends LayoutOptions, NodeOptions {
  allowBase64: boolean;
  inline: boolean;
}

export type SetImageOptions = {
  src: string;
  alt?: string;
  title?: string;
} & LayoutOptions;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    image: {
      setImage: (options: SetImageOptions) => ReturnType;
    };
  }
}

export const Image = Node.create<ImageOptions>({
  name: "Image",
  draggable: true,

  addOptions() {
    return {
      allowBase64: false,
      modal: null,
      margin: "0in",
      clear: "none",
      float: "unset",
      display: "block",
      HTMLAttributes: {},
      inline: false,
      width: 250,
      height: 160,
    };
  },

  inline() {
    return this.options.inline;
  },

  group() {
    return this.options.inline ? "inline" : "block";
  },

  addAttributes() {
    return {
      keyId: {
        default: generateShortId(),
      },
      margin: {
        default: this.options.margin,
      },
      clear: {
        default: this.options.clear,
      },
      float: {
        default: this.options.float,
      },
      display: {
        default: this.options.display,
      },
      transform: {
        default: "rotate(0deg)",
      },
      width: {
        default: this.options.width,
      },
      height: {
        default: this.options.height,
      },
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: this.options.allowBase64 ? "img[src]" : 'img[src]:not([src^="data:"])',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const height = parseInt(HTMLAttributes.height);
    const width = parseInt(HTMLAttributes.width);
    const float = HTMLAttributes.float;
    const clear = HTMLAttributes.clear;
    const margin = HTMLAttributes.margin;

    return [
      "img",
      mergeAttributes(this.options.HTMLAttributes, {
        ...HTMLAttributes,
        class: "hypermultimedia--image__content",
        style: ` height:${height}px; width: ${width}px; float: ${float}; clear: ${clear}; margin: ${margin}`,
      }),
    ];
  },

  addCommands() {
    return {
      setImage:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: inputRegex,
        type: this.type,
        getAttributes: (match) => {
          const [, , alt, src, title] = match;

          return { src, alt, title };
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    const { tooltip, tippyModal } = createTooltip(this.editor);

    const handleImageEvent = (view: EditorView, event: MouseEvent | TouchEvent) => {
      this.editor.commands.blur();

      imageClickHandler(view, event, {
        editor: this.editor,
        tooltip,
        tippyModal,
        modal: this.options.modal || null,
      });
      return true;
    };

    return [
      new Plugin({
        key: new PluginKey("ImageClickHandler"),
        props: {
          handleDOMEvents: {
            click: handleImageEvent,
            touchend: handleImageEvent,
          },
        },
      }),
    ];
  },
});
