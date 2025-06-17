import { Editor } from "@tiptap/core";
import { EditorView } from "@tiptap/pm/view";
import Tippy from "./tippyHelper";
import tippy, { Instance, Props as TippyProps } from "tippy.js";

interface MarginOption {
  value: string;
  text: string;
}

export interface StyleAttributes {
  display?: string;
  height?: number | string;
  width?: number | string;
  float?: string;
  clear?: string;
  margin?: string;
  justifyContent?: string;
}

export type Ttooltip = {
  hide: () => void;
  update: (view: EditorView, options: Partial<TippyProps>, target: HTMLElement) => void;
  show: () => void;
};

const MARGIN_OPTIONS: MarginOption[] = [
  { value: "0in", text: '0"' },
  { value: "0.06in", text: '1/16"' },
  { value: "0.13in", text: '1/8"' },
  { value: "0.25in", text: '1/4"' },
  { value: "0.38in", text: '3/8"' },
  { value: "0.5in", text: '1/2"' },
  { value: "0.75in", text: '3/4"' },
  { value: "1in", text: '1"' },
];

export const clearChildNodes = (node: HTMLElement) => {
  while (node.firstChild) node.removeChild(node.firstChild);
};

export const createElement = (tag: string, className = "", innerHTML = ""): HTMLElement => {
  const elem = document.createElement(tag);
  if (className) elem.classList.add(className);
  if (innerHTML) elem.innerHTML = innerHTML;
  return elem;
};

export const applyStyleAndAttributes = (
  element: HTMLElement,
  style: string | Object,
  attributes: Object,
  editor: Editor,
  tooltip: Ttooltip,
  nodePos: number
) => {
  // Apply styles to element
  Object.assign(element.style, style);

  // Start a new transaction
  const { state, dispatch } = editor.view;
  let transaction = state.tr;

  const node = transaction.doc.nodeAt(nodePos);

  if (node) {
    transaction.setNodeMarkup(nodePos, null, {
      ...node.attrs,
      ...attributes,
    });
    dispatch(transaction);
  }

  // Hide the tooltip
  tooltip.hide();
};

const updateNodeAttribute = (editor: Editor, nodePos: number, attribute: string, value: string) => {
  const { state } = editor;
  const { tr } = state;
  tr.setNodeAttribute(nodePos, attribute, value);
  editor.view.dispatch(tr);
};

export const createMarginSelection = (
  nodePos: number,
  targetElement: HTMLElement,
  tooltip: Ttooltip,
  editor: Editor,
  mediaMargin: string
): HTMLSelectElement => {
  const selectMargin = createElement("select") as HTMLSelectElement;
  MARGIN_OPTIONS.forEach(({ value, text }) => {
    const option = createElement("option", "", `${text} margin`) as HTMLOptionElement;
    option.value = value;
    if (mediaMargin === value) option.selected = true;
    selectMargin.append(option);
  });

  selectMargin.addEventListener("change", (e) => {
    const newMargin = (e.target as HTMLSelectElement).value;
    updateNodeAttribute(editor, nodePos, "margin", newMargin);
    targetElement.style.margin = newMargin;

    // Update the modal position
    const imageDOM = editor.view.nodeDOM(nodePos) as HTMLElement;
    tooltip.update(editor.view, { placement: "bottom-start" }, imageDOM);
  });

  return selectMargin;
};

export const btnPlacementSettings = (
  mediaElementMargin: string,
  [buttonInline, btnSquareCenter, btnSquareLeft, btnSquareRight]: HTMLElement[]
) => [
  {
    button: buttonInline,
    style: { display: "block", float: "none", clear: "none", margin: "0" },
    attributes: { display: "block", float: "none", clear: "none", margin: "0" },
  },
  {
    button: btnSquareCenter,
    style: {
      display: "flex",
      "justify-content": "center",
      float: "none",
      clear: "none",
      margin: "auto",
    },
    attributes: {
      display: "flex",
      justifyContent: "center",
      float: "none",
      clear: "none",
      margin: "auto",
    },
  },
  {
    button: btnSquareLeft,
    style: { display: "block", float: "left", clear: "none", margin: mediaElementMargin },
    attributes: { display: "block", float: "left", clear: "none", margin: mediaElementMargin },
  },
  {
    button: btnSquareRight,
    style: { display: "block", float: "right", clear: "none", margin: mediaElementMargin },
    attributes: { display: "block", float: "right", clear: "none", margin: mediaElementMargin },
  },
];

export const highlightButton = (
  float: string,
  imgMargin: string,
  display: string,
  buttons: { [key: string]: HTMLElement }
) => {
  const activeClass = "hypermultimedia__modal--active";
  const { btnSquareLeft, btnSquareRight, buttonInline, btnSquareCenter } = buttons;

  [btnSquareLeft, btnSquareRight, buttonInline, btnSquareCenter].forEach((btn) =>
    btn.classList.remove(activeClass)
  );

  switch (true) {
    case float === "left":
      btnSquareLeft.classList.add(activeClass);
      break;
    case float === "right":
      btnSquareRight.classList.add(activeClass);
      break;
    case display === "block" && imgMargin === "0":
      buttonInline.classList.add(activeClass);
      break;
    case float === "none" && imgMargin === "auto":
      btnSquareCenter.classList.add(activeClass);
      break;
    default:
      console.error("No matching case found.");
  }
};

let tooltipInstance: {
  tooltip: Tippy | null;
  tippyModal: HTMLElement | null;
  tippyInstance: Instance | undefined;
} | null = null;

export const createTooltip = (
  editor: Editor
): {
  tooltip: Tippy | null;
  tippyModal: HTMLElement | null;
  tippyInstance: Instance | undefined;
} => {
  // Return existing instance if available
  if (tooltipInstance) return tooltipInstance;

  const tooltip = new Tippy({
    editor: editor,
    // targetElement: "#editorContents",
  });

  const { tippyModal, tippyInstance } = tooltip.init();

  // Store the instance
  tooltipInstance = {
    tooltip,
    tippyModal,
    tippyInstance,
  };

  return tooltipInstance;
};

export const getTooltipInstance = (): {
  tooltip: Tippy | null;
  tippyModal: HTMLElement | null;
  tippyInstance: Instance | undefined;
} | null => {
  return tooltipInstance;
};

export const applyStyles = (dom: HTMLElement, styles: StyleAttributes): void => {
  for (const [key, value] of Object.entries(styles)) {
    if (value !== undefined && value !== null) {
      dom.style[key as any] = typeof value === "number" ? `${value}px` : value;
    }
  }
};

export const generateShortId = () => {
  const randomPart = Math.random().toString(36).substr(2, 5); // 5 random characters
  const timePart = Date.now().toString(36).slice(-5); // last 5 characters of the current time
  return `${randomPart}-${timePart}`;
};

export interface StyleLayoutOptions {
  width?: number | string;
  height?: number | string;
  margin?: string;
  clear?: string;
  float?: string;
  display?: string;
  justifyContent?: string;
}

/**
 * Filters and formats style properties.
 * @param {Record<string, string | number | null>} styleProps - An object containing style properties and their values.
 * @returns {string} - The formatted style string.
 */
const formatStyleProperties = (styleProps: Record<string, string | number | null>): string =>
  Object.entries(styleProps)
    .filter(([, value]) => value != null) // Filter out null or undefined values.
    .map(([key, value]) => `${key}:${value};`) // Map to "key:value;" format.
    .join(" "); // Join all entries into a single string.

/**
 * Creates a style string from the options and HTMLAttributes.
 * @param {StyleLayoutOptions} options - The node options that may contain style properties.
 * @param {StyleLayoutOptions} HTMLAttributes - The HTML attributes that may contain style properties.
 * @returns {string} - The concatenated style string.
 */
export const createStyleString = (
  options: StyleLayoutOptions,
  HTMLAttributes: StyleLayoutOptions
): string => {
  const styles: Record<string, string | null> = {
    height:
      options.height || HTMLAttributes.height
        ? `${options.height || parseInt(HTMLAttributes.height as string, 10)}px`
        : null,
    width:
      options.width || HTMLAttributes.width
        ? `${options.width || parseInt(HTMLAttributes.width as string, 10)}px`
        : null,
    float: HTMLAttributes.float || null,
    clear: HTMLAttributes.clear || null,
    margin: HTMLAttributes.margin || null,
  };

  return formatStyleProperties(styles);
};
