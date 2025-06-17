import { Node, mergeAttributes, nodePasteRule } from "@tiptap/core";
import { SOUNDCLOUD_URL_REGEX_GLOBAL, getSoundCloudEmbedUrl, isValidSoundCloudUrl } from "./helper";
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

export interface SoundCloudOptions extends LayoutOptions, NodeOptions {
  // URL Search Params attributes
  autoPlay?: boolean; // set to true to autoplay the track on load
  hideRelated?: boolean; // set to true to hide related tracks
  showComments?: boolean; // set to false to hide comments
  showUser?: boolean; // set to false to hide the uploader name and avatar
  showReposts?: boolean; // set to false to hide reposts
  auto_play?: boolean; // Play track automatically
  hide_related?: boolean; // Hide related tracks in the visual player
  visual?: boolean; // set to true for a video player, false for audio player
  color?: string; // hex code, Color play button and other controls. e.g. “#0066CC”
  buying?: boolean; // Show/Hide buy buttons
  sharing?: boolean; // Show/Hide share buttons
  download?: boolean; // Show/Hide download buttons
  show_artwork?: boolean; // Show/Hide the item’s artwork
  show_playcount?: boolean; // Show/Hide the item’s playcount
  show_user?: boolean; // Show/Hide the uploader’s name
  start_track?: number; // A number from 0 to the playlist length which reselects the track in a playlist
  single_active?: boolean; // If set to false the multiple players on the page won’t toggle each other off when playing

  // Iframe html attributes
  scrolling?: string; // set to yes to allow scrolling
  frameborder?: string; // set to no to hide frame border
  allow?: string; // set to autoplay to allow the track to `autoplay`
}

type SetSoundCloudOptions = {
  src: string;
} & LayoutOptions;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    SoundCloud: {
      setSoundCloud: (options: SetSoundCloudOptions) => ReturnType;
    };
  }
}

export const SoundCloud = Node.create<SoundCloudOptions>({
  name: "SoundCloud",
  draggable: true,

  addOptions() {
    return {
      width: 450,
      height: 120,
      visual: false,
      addPasteHandler: true,
      HTMLAttributes: {},
      modal: null,
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
      scrolling: {
        default: "no",
      },
      frameborder: {
        default: "no",
      },
      allow: {
        default: "autoplay",
      },
      width: {
        default: this.options.width,
      },
      height: {
        default: this.options.height,
      },
      src: null,
      autoPlay: null,
      hideRelated: null,
      showComments: null,
      showUser: null,
      showReposts: null,
      auto_play: null,
      hide_related: null,
      visual: null,
      color: null,
      buying: null,
      sharing: null,
      download: null,
      show_artwork: null,
      show_playcount: null,
      show_user: null,
      start_track: null,
      single_active: null,
    };
  },

  addNodeView() {
    return ({ node, HTMLAttributes }) => {
      const editor = this.editor;
      const modal = this.options.modal;

      const dom = document.createElement("div");
      const content = document.createElement("div");
      const iframe = document.createElement("iframe");

      const { tooltip, tippyModal } = createTooltip(editor);

      dom.classList.add("hypermultimedia--soundcloud__content");

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

      if (styles?.height > 130) {
        HTMLAttributes.visual = true;
      }

      const soundCloudAttrs = {
        url: node.attrs.src,
        auto_play: node.attrs.auto_play,
        hide_related: node.attrs.hide_related,
        visual: node.attrs.visual,
        color: node.attrs.color,
        buying: node.attrs.buying,
        sharing: node.attrs.sharing,
        download: node.attrs.download,
        show_artwork: node.attrs.show_artwork,
        show_playcount: node.attrs.show_playcount,
        show_user: node.attrs.show_user,
        start_track: node.attrs.start_track,
        single_active: node.attrs.single_active,
      };

      const embedUrl = getSoundCloudEmbedUrl(soundCloudAttrs);
      HTMLAttributes.src = embedUrl;

      const attributes = mergeAttributes(this.options.HTMLAttributes, {
        "data-node-name": this.name,
        scrolling: node.attrs.scrolling,
        frameborder: node.attrs.frameborder,
        allow: node.attrs.allow,
        width: node.attrs.width,
        height: node.attrs.height,
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
          if (updatedNode.type.name !== this.name) return true;
          return false;
        },
      };
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-soundcloud] iframe",
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const height = parseInt(HTMLAttributes.height);
    const width = parseInt(HTMLAttributes.width);
    const float = HTMLAttributes.float;
    const clear = HTMLAttributes.clear;
    const margin = HTMLAttributes.margin;
    const display = HTMLAttributes.display;
    const justifyContent = HTMLAttributes.justifyContent;

    if (height > 130) {
      HTMLAttributes.visual = true;
    }

    const embedUrl = getSoundCloudEmbedUrl({
      url: HTMLAttributes.src,
    });

    HTMLAttributes.src = embedUrl;

    const style = `display: ${display}; justify-content: ${justifyContent}, height:${height}px; width: ${width}px; float: ${float}; clear: ${clear}; margin: ${margin}`;

    return [
      "div",
      { "data-soundcloud-video": "", class: "soundcloud-video", style },
      [
        "iframe",
        mergeAttributes(
          this.options.HTMLAttributes,
          {
            width: node.attrs.width,
            height: node.attrs.height,
            scrolling: node.attrs.scrolling,
            frameborder: node.attrs.frameborder,
            allow: node.attrs.allow,
          },
          HTMLAttributes
        ),
      ],
    ];
  },

  addCommands() {
    return {
      setSoundCloud:
        (options) =>
        ({ commands }) => {
          if (!isValidSoundCloudUrl(options.src)) return false;

          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },

  addPasteRules() {
    if (!this.options.addPasteHandler) return [];

    return [
      nodePasteRule({
        find: SOUNDCLOUD_URL_REGEX_GLOBAL,
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
