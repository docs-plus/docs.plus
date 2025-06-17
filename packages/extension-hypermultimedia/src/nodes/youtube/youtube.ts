import { mergeAttributes, Node, nodePasteRule } from "@tiptap/core";
import { getEmbedUrlFromYoutubeUrl, isValidYoutubeUrl, YOUTUBE_REGEX_GLOBAL } from "./helper";
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

export interface YoutubeOptions extends LayoutOptions, NodeOptions {
  // URL Search Params attributes
  autoplay: 0 | 1;
  ccLanguage?: string;
  ccLoadPolicy?: 0 | 1;
  controls: 0 | 1;
  disableKBcontrols: 0 | 1;
  enableIFrameApi: 0 | 1;
  endTime?: number;
  interfaceLanguage?: string;
  ivLoadPolicy: 1 | 3;
  loop: 0 | 1;
  nocookie?: boolean;
  origin?: string;
  playlist?: string;

  // Iframe html attributes
  frameborder?: number; // 0
  allow?: string; // accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture
  allowfullscreen?: boolean;
}

type SetYoutubeVideoOptions = {
  src: string;
} & LayoutOptions;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    Youtube: {
      setYoutubeVideo: (options: SetYoutubeVideoOptions) => ReturnType;
    };
  }
}

export const Youtube = Node.create<YoutubeOptions>({
  name: "Youtube",

  addOptions() {
    return {
      addPasteHandler: true,
      allowFullscreen: true,
      autoplay: 0,
      ccLanguage: undefined,
      ccLoadPolicy: undefined,
      controls: 0,
      disableKBcontrols: 0,
      enableIFrameApi: 0,
      endTime: 0,
      height: 480,
      modal: null,
      interfaceLanguage: undefined,
      ivLoadPolicy: 1,
      loop: 0,
      HTMLAttributes: {},
      nocookie: false,
      origin: undefined,
      playlist: undefined,
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
    return ({ node, HTMLAttributes, editor }) => {
      const modal = this.options.modal;

      const { tooltip, tippyModal } = createTooltip(editor);

      const dom = document.createElement("div");
      const content = document.createElement("div");
      const iframe = document.createElement("iframe");

      dom.contentEditable = "false";

      dom.classList.add("hypermultimedia--youtube__content");

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

      const youtubeAttrs = {
        url: HTMLAttributes.src,
        autoplay: node.attrs.autoplay,
        ccLanguage: node.attrs.ccLanguage,
        ccLoadPolicy: node.attrs.ccLoadPolicy,
        controls: node.attrs.controls,
        disableKBcontrols: node.attrs.disableKBcontrols,
        enableIFrameApi: node.attrs.enableIFrameApi,
        endTime: node.attrs.endTime,
        interfaceLanguage: node.attrs.interfaceLanguage,
        ivLoadPolicy: node.attrs.ivLoadPolicy,
        loop: node.attrs.loop,
        nocookie: node.attrs.nocookie,
        origin: node.attrs.origin,
        playlist: node.attrs.playlist,
      };

      const embedUrl = getEmbedUrlFromYoutubeUrl(youtubeAttrs) as string;

      HTMLAttributes.src = embedUrl;

      const attributes = mergeAttributes(this.options.HTMLAttributes, {
        "data-node-name": this.name,
        width: node.attrs.width,
        height: node.attrs.height,
        allow: node.attrs.allow,
        frameborder: node.attrs.frameborder,
        autoplay: node.attrs.autoplay,
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
        tag: "div[data-youtube-video] iframe",
      },
    ];
  },

  addCommands() {
    return {
      setYoutubeVideo:
        (options: SetYoutubeVideoOptions) =>
        ({ commands }) => {
          if (!isValidYoutubeUrl(options.src)) return false;

          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const embedUrl = getEmbedUrlFromYoutubeUrl({
      url: HTMLAttributes.src,
      autoplay: node.attrs.autoplay,
      ccLanguage: node.attrs.ccLanguage,
      ccLoadPolicy: node.attrs.ccLoadPolicy,
      controls: node.attrs.controls,
      disableKBcontrols: node.attrs.disableKBcontrols,
      enableIFrameApi: node.attrs.enableIFrameApi,
      endTime: node.attrs.endTime,
      interfaceLanguage: node.attrs.interfaceLanguage,
      ivLoadPolicy: node.attrs.ivLoadPolicy,
      loop: node.attrs.loop,
      nocookie: node.attrs.nocookie,
      origin: node.attrs.origin,
      playlist: node.attrs.playlist,
    });

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
      { "data-youtube-video": "", class: "youtube-video", style },
      [
        "iframe",
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
          width: node.attrs.width,
          height: node.attrs.height,
          allow: node.attrs.allow,
          frameborder: node.attrs.frameborder,
          autoplay: node.attrs.autoplay,
        }),
      ],
    ];
  },

  addPasteRules() {
    if (!this.options.addPasteHandler) return [];

    return [
      nodePasteRule({
        find: YOUTUBE_REGEX_GLOBAL,
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
