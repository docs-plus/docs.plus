import { Node, mergeAttributes, nodePasteRule } from "@tiptap/core";
import { getEmbedUrlFromVimeoUrl, isValidVimeoUrl, VIMEO_REGEX_GLOBAL } from "./helper";
import { createTooltip, applyStyles, generateShortId } from "../../utils/utils";
import { MediaPlacement } from "../../utils/media-placement";

interface LayoutOptions {
  width?: number;
  height?: number;
  margin?: string;
  clear?: string;
  float?: string;
  display?: string;
  justifyContent?: string;
}

interface NodeOptions {
  inline: boolean;
  addPasteHandler: boolean;
  HTMLAttributes: Record<string, any>;
  modal?: ((options: MediaPlacement) => HTMLElement | void | null) | null;
}

export interface VimeoOptions extends LayoutOptions, NodeOptions {
  // URL Search Params attributes
  autopause?: boolean;
  autoplay?: boolean;
  background?: boolean;
  byline?: boolean | "site-default";
  color?: string;
  controls?: boolean;
  dnt?: boolean;
  keyboard?: boolean;
  loop?: boolean;
  muted?: boolean;
  pip?: boolean;
  playsinline?: boolean;
  portrait?: boolean | "site-default";
  quality?: "240p" | "360p" | "540p" | "720p" | "1080p" | "2k" | "4k" | "auto";
  speed?: boolean;
  startTime?: string;
  texttrack?: string | false;
  title?: boolean;

  // Iframe html attributes
  frameborder?: number; // false
  allowfullscreen?: boolean; // true
}

type SetVimeoOptions = {
  src: string;
} & LayoutOptions;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    Vimeo: {
      setVimeo: (options: SetVimeoOptions) => ReturnType;
    };
  }
}

export const Vimeo = Node.create<VimeoOptions>({
  name: "Vimeo",
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      modal: null,
      addPasteHandler: true,
      autopause: true,
      autoplay: false,
      background: false,
      byline: true,
      color: "#00adef",
      controls: true,
      dnt: false,
      keyboard: true,
      loop: false,
      muted: false,
      pip: false,
      playsinline: false,
      portrait: true,
      quality: "auto",
      speed: false,
      startTime: "0",
      texttrack: false,
      title: true,
      height: 480,
      width: 640,
      justifyContent: "start",
      margin: "0in",
      clear: "none",
      float: "unset",
      display: "block",
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
      src: {
        default: null,
      },
      start: {
        default: 0,
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
      const iframe = document.createElement("iframe");

      dom.classList.add("hypermultimedia--vimeo__content");

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

      const vimeoAttrs = {
        url: HTMLAttributes.src,
        autopause: this.options.autopause,
        autoplay: this.options.autoplay,
        background: this.options.background,
        byline: this.options.byline,
        color: this.options.color,
        controls: this.options.controls,
        dnt: this.options.dnt,
        keyboard: this.options.keyboard,
        loop: this.options.loop,
        muted: this.options.muted,
        pip: this.options.pip,
        playsinline: this.options.playsinline,
        portrait: this.options.portrait,
        quality: this.options.quality,
        speed: this.options.speed,
        startTime: this.options.startTime,
        texttrack: this.options.texttrack,
        title: this.options.title,
        height: this.options.height,
        width: this.options.width,
      };

      const embedUrl = getEmbedUrlFromVimeoUrl(vimeoAttrs) || "";

      HTMLAttributes.src = embedUrl;

      const attributes = mergeAttributes(this.options.HTMLAttributes, {
        "data-node-name": this.name,
        width: node.attrs.width,
        height: node.attrs.height,
        frameborder: node.attrs.frameborder,
        allowfullscreen: node.attrs.allowfullscreen,
      });

      if (modal) {
        iframe.addEventListener("mouseenter", (e) => {
          if (tooltip && tippyModal) {
            modal({ editor, tooltip, tippyModal, iframe, wrapper: dom });
          }
        });
      }

      iframe.setAttribute("src", embedUrl);

      Object.entries(attributes).forEach(([key, value]) => iframe.setAttribute(key, value));

      content.append(iframe);

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
            iframe.style.height = `${updatedNode.attrs.height}px`;
            dom.style.width = `${updatedNode.attrs.width}px`;
            iframe.style.width = `${updatedNode.attrs.width}px`;
            iframe.width = `${updatedNode.attrs.width}`;
            iframe.height = `${updatedNode.attrs.height}`;

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
        tag: "div[data-vimeo-video] iframe",
      },
    ];
  },

  addCommands() {
    return {
      setVimeo:
        (options: SetVimeoOptions) =>
        ({ commands }) => {
          if (!isValidVimeoUrl(options.src)) return false;

          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const vimeoAttrs = {
      url: HTMLAttributes.src,
      autopause: this.options.autopause,
      autoplay: this.options.autoplay,
      background: this.options.background,
      byline: this.options.byline,
      color: this.options.color,
      controls: this.options.controls,
      dnt: this.options.dnt,
      keyboard: this.options.keyboard,
      loop: this.options.loop,
      muted: this.options.muted,
      pip: this.options.pip,
      playsinline: this.options.playsinline,
      portrait: this.options.portrait,
      quality: this.options.quality,
      speed: this.options.speed,
      startTime: this.options.startTime,
      texttrack: this.options.texttrack,
      title: this.options.title,
      height: this.options.height,
      width: this.options.width,
    };

    const embedUrl = getEmbedUrlFromVimeoUrl(vimeoAttrs);
    HTMLAttributes.src = embedUrl;

    const height = parseInt(HTMLAttributes.height);
    const width = parseInt(HTMLAttributes.width);
    const float = HTMLAttributes.float;
    const clear = HTMLAttributes.clear;
    const margin = HTMLAttributes.margin;
    const display = HTMLAttributes.display;

    const style = `display: ${display}; height:${height}px; width: ${width}px; float: ${float}; clear: ${clear}; margin: ${margin}`;

    return [
      "div",
      { "data-vimeo-video": "", class: "vimeo-video", style },
      [
        "iframe",
        mergeAttributes(
          this.options.HTMLAttributes,
          {
            width: node.attrs.width,
            height: node.attrs.height,
            frameborder: node.attrs.frameborder,
            allowfullscreen: node.attrs.allowfullscreen,
          },
          HTMLAttributes
        ),
      ],
    ];
  },

  addPasteRules() {
    if (!this.options.addPasteHandler) return [];

    return [
      nodePasteRule({
        find: VIMEO_REGEX_GLOBAL,
        type: this.type,
        getAttributes: (match) => {
          return { src: match.input };
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    return [];
  },
});
