import { Node, mergeAttributes, nodeInputRule } from "@tiptap/core";
import { MediaPlacement } from "../../utils/media-placement";
import {
  createTooltip,
  generateShortId,
  createStyleString,
  StyleLayoutOptions,
  applyStyles,
} from "../../utils/utils";
import { inputRegex } from "./helper";

interface VideoAttributes {
  src?: string | null;
  controls?: boolean;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  preload?: "none" | "metadata" | "auto";
  [key: string]: any; // Add an index signature
}

interface NodeOptions {
  HTMLAttributes: Record<string, any>;
  modal?: ((options: MediaPlacement) => HTMLElement | void | null) | null;
}

export interface VideoOptions extends StyleLayoutOptions, NodeOptions {
  // Node attributes
  inline?: boolean;

  // Html attributes
  controls?: boolean;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  poster?: string | null;
  preload?: "none" | "metadata" | "auto";
  src: string | null;
}

export type SetVideoOptions = {
  src: string;
} & StyleLayoutOptions;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    Video: {
      setVideo: (options: SetVideoOptions) => ReturnType;
    };
  }
}

export const Video = Node.create<VideoOptions>({
  name: "Video",
  draggable: true,

  addOptions() {
    return {
      src: null,
      modal: null,
      margin: "0in",
      clear: "none",
      float: "unset",
      display: "block",
      justifyContent: "start",
      HTMLAttributes: {},
      inline: false,
      controls: true,
      height: 480,
      width: 640,
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
      poster: {
        default: null,
      },
      preload: {
        default: "metadata",
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
        default: this.options.width,
      },
      height: {
        default: this.options.height,
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
      const videoTag = document.createElement("video") as HTMLVideoElement;

      dom.classList.add("hypermultimedia--video__content");

      const styles = {
        display: node.attrs.display,
        height: parseInt(HTMLAttributes.height),
        width: parseInt(HTMLAttributes.width),
        float: node.attrs.float,
        clear: node.attrs.clear,
        margin: node.attrs.margin,
        justifyContent: node.attrs.justifyContent,
      };

      applyStyles(dom, styles);

      const htmlAttributes: VideoAttributes = {
        src: this.options.src || HTMLAttributes.src,
        controls: this.options.controls,
        autoplay: this.options.autoplay,
        loop: this.options.loop,
        muted: this.options.muted,
        preload: this.options.preload,
      };

      const style = createStyleString(this.options, styles);

      // loop through the attributes and remove any that are null or false
      // (since they're not needed)
      Object.keys(htmlAttributes).forEach((key) => {
        if (htmlAttributes[key] === null || htmlAttributes[key] === false) {
          delete htmlAttributes[key];
        }
      });

      const attributes = mergeAttributes(htmlAttributes, {
        "data-node-name": this.name,
        style,
      });

      if (modal) {
        videoTag.addEventListener("mouseenter", (e) => {
          if (tooltip && tippyModal) {
            modal({ editor, tooltip, tippyModal, iframe: videoTag, wrapper: dom });
          }
        });
      }

      Object.entries(attributes).forEach(
        ([key, value]) => value && videoTag.setAttribute(key, value)
      );

      content.append(videoTag);
      dom.append(content);

      return {
        dom,
        contentDOM: content,
        ignoreMutation: (mutation) => {
          return !dom.contains(mutation.target) || dom === mutation.target;
        },
        update: (updatedNode) => {
          if (
            updatedNode.type.name === this.name &&
            (updatedNode.attrs.height !== this.options.height ||
              updatedNode.attrs.width !== this.options.width)
          ) {
            dom.style.height = `${updatedNode.attrs.height}px`;
            dom.style.width = `${updatedNode.attrs.width}px`;

            videoTag.style.height = `${updatedNode.attrs.height}px`;
            videoTag.style.width = `${updatedNode.attrs.width}px`;

            // @ts-ignore
            videoTag.width = `${updatedNode.attrs.width}`;
            // @ts-ignore
            videoTag.height = `${updatedNode.attrs.height}`;

            return true;
          }
          if (updatedNode.type.name !== this.name) return false;
          return true;
        },
      };
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-video] video[src]",
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

    const htmlAttributes: VideoAttributes = {
      src: this.options.src || HTMLAttributes.src,
      controls: this.options.controls,
      autoplay: this.options.autoplay,
      loop: this.options.loop,
      muted: this.options.muted,
      preload: this.options.preload,
      poster: this.options.poster,
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
      { "data-video": "", class: "hypermultimedia--video__content", style },
      [
        "video",
        mergeAttributes(htmlAttributes, { class: "hypermultimedia--video__content", style }),
        0, // Zero indicates that this node can have content. For audio, it's usually empty.
      ],
    ];
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: inputRegex,
        type: this.type,
        getAttributes: (match) => {
          const [, , src, title, width, height] = match;

          return { src, title, width, height };
        },
      }),
    ];
  },

  addCommands() {
    return {
      setVideo:
        (options) =>
        ({ commands }) => {
          if (!options.src) {
            throw new Error("VideoAttributes source is required");
          }

          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});
