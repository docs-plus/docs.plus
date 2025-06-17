import { Node, nodePasteRule } from "@tiptap/core";
import {
  isValidTwitterUrl,
  TWITTER_URL_REGEX_GLOBAL,
  loadTwitterScript,
  fetchOEmbedHtml,
} from "./helper";
import { createTooltip, applyStyles, generateShortId } from "../../utils/utils";
import { MediaPlacement } from "../../utils/media-placement";

interface LayoutOptions {
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

export interface TwitterOptions extends LayoutOptions, NodeOptions {
  id?: string; // Tweet ID
  theme?: "light" | "dark"; // Theme of the embedded Tweet
  width?: number | string; // Width of the embedded Tweet, e.g., 550 or '550px'
  height?: number | string; // Height of the embedded Tweet, e.g., 600 or '600px'
  dnt?: boolean; // Data tracking parameter
  lang?: string; // Language parameter, e.g., 'en' for English
  limit?: number; //	Display up to N items where N is a value between 1 and 20 inclusive
  maxwidth?: number; // Set the maximum width of the widget. Must be between 180 and 1200 inclusive
  maxheight?: number; // Set the maximum height of the widget. Must be greater than 200
  chrome?: "noheader" | "nofooter" | "noborders" | "noscrollbar" | "transparent" | string;
  aria_polite?: string; // Set an assertive ARIA live region politeness value for Tweets added to a timeline
}

type AddTwitterOptions = {
  src: string;
} & LayoutOptions;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    Twitter: {
      setTwitter: (options: AddTwitterOptions) => ReturnType;
    };
  }
}

export const Twitter = Node.create({
  name: "Twitter",
  draggable: true,

  addOptions() {
    return {
      theme: "light",
      lang: "en",
      dnt: true,
      modal: null,
      addPasteHandler: true,
      HTMLAttributes: {},
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
      src: {
        default: null,
      },
      theme: {
        default: this.options.theme,
      },
      lang: {
        default: this.options.lang,
      },
      cards: {
        default: null,
      },
      conversation: {
        default: null,
      },
      width: {
        default: null,
      },
      align: {
        default: null,
      },
      dnt: {
        default: this.options.dnt,
      },
      dir: {
        default: null,
      },
      hideCard: {
        default: null,
      },
      hideThread: {
        default: null,
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
    };
  },

  parseHTML() {
    return [
      {
        tag: "blockquote.twitter-tweet",
        getAttrs: (node: string | HTMLElement) => {
          if (typeof node === "string") return {};

          return {
            src: (node as HTMLElement).querySelector("a")?.getAttribute("href"),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const url = HTMLAttributes.src;

    return [
      "blockquote",
      {
        class: "twitter-tweet",
        ...HTMLAttributes,
      },
      ["a", { href: url }, url],
    ];
  },

  addNodeView() {
    return ({ node, HTMLAttributes, editor }) => {
      const modal = this.options.modal;

      const wrapper = document.createElement("div");
      wrapper.classList.add("hypermultimedia--twitter__content");

      const { tooltip, tippyModal } = createTooltip(editor);

      const styles = {
        display: node.attrs.display,
        height: parseInt(node.attrs.height),
        width: parseInt(node.attrs.width),
        float: node.attrs.float,
        clear: node.attrs.clear,
        margin: node.attrs.margin,
        justifyContent: node.attrs.justifyContent,
      };

      applyStyles(wrapper, styles);

      if (styles?.height > 130) {
        HTMLAttributes.visual = true;
      }

      const blockquote = document.createElement("blockquote");
      blockquote.classList.add("twitter-tweet");

      // append all HTMLAttributes to the blockquote
      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        if (this.options[key] || value)
          blockquote.setAttribute(`data-${key}`, value || this.options[key]);
      });

      const anchor = document.createElement("a");
      anchor.href = HTMLAttributes.url;
      anchor.textContent = HTMLAttributes.url;

      blockquote.appendChild(anchor);
      wrapper.appendChild(blockquote);

      if (modal) {
        wrapper.addEventListener("mouseenter", (e) => {
          const iframe = wrapper.querySelector("iframe") as HTMLIFrameElement;
          modal && modal({ editor, tooltip, tippyModal, wrapper, iframe });
        });
      }

      const params = {
        url: node.attrs.src,
        theme: this.options.theme,
        width: this.options.width,
        height: this.options.height,
        cards: this.options.cards,
        dnt: this.options.dnt,
        lang: this.options.lang,
        conversation: this.options.conversation,
        align: this.options.align,
        dir: this.options.dir,
        omit_script: 1,
        limit: this.options.limit,
        maxwidth: this.options.maxwidth,
        maxheight: this.options.maxheight,
        chrome: this.options.chrome,
        aria_polite: this.options.aria_polite,
      };

      // Fetch oEmbed HTML
      fetchOEmbedHtml(params)
        .then((html) => {
          wrapper.innerHTML = html;
          // Load Twitter widgets script
          setTimeout(() => {
            loadTwitterScript().then((twttr) => {
              twttr.widgets.load(wrapper);
            });
          }, 100);
        })
        .catch((error) => {
          loadTwitterScript().then((twttr) => {
            twttr.widgets.load(wrapper);
          });
        });

      return {
        dom: wrapper,
        ignoreMutation: (mutation) => {
          return !wrapper.contains(mutation.target) || wrapper === mutation.target;
        },
        update: (updatedNode) => {
          if (updatedNode.type.name !== this.name) return false;
          return true;
        },
      };
    };
  },

  addCommands() {
    return {
      setTwitter:
        (options) =>
        ({ commands }) => {
          if (!isValidTwitterUrl(options.src)) return false;

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
        find: TWITTER_URL_REGEX_GLOBAL,
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
