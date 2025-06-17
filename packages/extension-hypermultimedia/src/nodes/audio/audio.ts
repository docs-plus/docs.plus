import { Node, mergeAttributes, nodeInputRule } from "@tiptap/core";
import {
  createTooltip,
  generateShortId,
  createStyleString,
  StyleLayoutOptions,
  applyStyles,
} from "../../utils/utils";
import { inputRegex } from "./helper";
import { MediaPlacement } from "../../utils/media-placement";

interface AudioAttributes {
  src?: string | null;
  controls?: boolean;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  preload?: "none" | "metadata" | "auto";
  volume?: number;
  [key: string]: any; // Add an index signature
}

interface NodeOptions {
  HTMLAttributes: Record<string, any>;
  modal?: ((options: MediaPlacement) => HTMLElement | void | null) | null;
}

export interface AudioOptions extends StyleLayoutOptions, NodeOptions {
  // Node attributes
  inline?: boolean;

  // Html attributes
  controls?: boolean;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  preload?: "none" | "metadata" | "auto";
  volume?: number;
  src: string | null;
}

export type SetAudioOptions = {
  src: string;
} & StyleLayoutOptions;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    Audio: {
      setAudio: (options: { src: string; title?: string; controls?: boolean }) => ReturnType;
    };
  }
}

export const Audio = Node.create<AudioOptions>({
  name: "Audio",
  draggable: true,

  addOptions() {
    return {
      src: null,
      controls: true,
      modal: null,
      margin: "0in",
      clear: "none",
      float: "unset",
      display: "block",
      justifyContent: "start",
      HTMLAttributes: {},
      inline: false,
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
      src: {
        default: null,
      },
      controls: {
        default: this.options.controls,
      },
      autoplay: {
        default: false,
      },
      loop: {
        default: false,
      },
      muted: {
        default: false,
      },
      preload: {
        default: "metadata", // Can be 'none', 'metadata', or 'auto'
      },
      volume: {
        default: 1.0,
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
      justifyContent: {
        default: this.options.justifyContent,
      },
      width: {
        default: null,
      },
      height: {
        default: null,
      },
    };
  },

  addNodeView() {
    return ({ node, HTMLAttributes }) => {
      const editor = this.editor;
      const modal = this.options.modal;
      const { tooltip, tippyModal } = createTooltip(editor);

      const dom = document.createElement("div");
      const content = document.createElement("div");
      const audioTag = document.createElement("audio");

      dom.classList.add("hypermultimedia--audio__content");

      const styles = {
        display: node.attrs.display,
        height: parseInt(node.attrs.height),
        width: parseInt(node.attrs.width),
        float: node.attrs.float,
        clear: node.attrs.clear,
        margin: node.attrs.margin,
        justifyContent: node.attrs.justifyContent,
      };

      applyStyles(dom, styles);

      const htmlAttributes: AudioAttributes = {
        src: this.options.src || HTMLAttributes.src,
        controls: this.options.controls,
        autoplay: this.options.autoplay,
        loop: this.options.loop,
        muted: this.options.muted,
        preload: this.options.preload,
        volume: this.options.volume,
      };

      // loop through the attributes and remove any that are null or false
      // (since they're not needed)
      Object.keys(htmlAttributes).forEach((key) => {
        if (htmlAttributes[key] === null || htmlAttributes[key] === false) {
          delete htmlAttributes[key];
        }
      });

      const attributes = mergeAttributes(htmlAttributes, {
        "data-node-name": this.name,
      });

      if (modal) {
        audioTag.addEventListener("mouseenter", (e) => {
          if (tooltip && tippyModal) {
            modal({ editor, tooltip, tippyModal, iframe: audioTag, wrapper: dom });
          }
        });
      }

      Object.entries(attributes).forEach(
        ([key, value]) => value && audioTag.setAttribute(key, value)
      );

      content.append(audioTag);
      dom.append(content);

      return {
        dom,
        contentDOM: content,
        ignoreMutation: (mutation) => {
          return !dom.contains(mutation.target) || dom === mutation.target;
        },
        update: (updatedNode) => {
          if (updatedNode.type.name !== this.name) return false;
          return true;
        },
      };
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-audio] audio[src]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const style = createStyleString(this.options, {
      height: parseInt(HTMLAttributes.height),
      width: parseInt(HTMLAttributes.width),
      float: HTMLAttributes.float,
      clear: HTMLAttributes.clear,
      margin: HTMLAttributes.margin,
    });

    const htmlAttributes: AudioAttributes = {
      src: this.options.src || HTMLAttributes.src,
      controls: this.options.controls,
      autoplay: this.options.autoplay,
      loop: this.options.loop,
      muted: this.options.muted,
      preload: this.options.preload,
      volume: this.options.volume,
    };

    // loop through the attributes and remove any that are null or false
    // (since they're not needed)
    Object.keys(htmlAttributes).forEach((key) => {
      if (htmlAttributes[key] === null || htmlAttributes[key] === false) {
        delete htmlAttributes[key];
      }
    });

    return [
      "div",
      { "data-audio": "", class: "hypermultimedia--audio__content", style },
      [
        "audio",
        mergeAttributes(htmlAttributes, { class: "hypermultimedia--audio__content", style }),
        0, // Zero indicates that this node can have content. For audio, it's usually empty.
      ],
    ];
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: inputRegex, // You'll need to define a regex for the audio similar to the video regex
        type: this.type,
        getAttributes: (match) => {
          const [, , src, width, height] = match;

          return { src, width, height };
        },
      }),
    ];
  },

  addCommands() {
    return {
      setAudio:
        (options) =>
        ({ commands }) => {
          if (!options.src) {
            throw new Error("Audio source is required");
          }

          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});
