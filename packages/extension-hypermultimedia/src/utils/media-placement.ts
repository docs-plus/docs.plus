import * as Icons from "./icons";
import { Editor } from "@tiptap/core";

import {
  clearChildNodes,
  createElement,
  applyStyleAndAttributes,
  createMarginSelection,
  btnPlacementSettings,
  highlightButton,
  Ttooltip,
} from "./utils";

export type MediaPlacement = {
  editor: Editor;
  tooltip: Ttooltip;
  tippyModal: HTMLElement;
  iframe: HTMLIFrameElement | HTMLImageElement | HTMLAudioElement | HTMLVideoElement | HTMLElement;
  wrapper: HTMLElement;
  extraActions?: HTMLElement[];
};

const buttonTypes: Icons.IconKeys[] = ["Inline", "Left", "InlineCenter", "Right"];

export const mediaPlacement = (options: MediaPlacement): void => {
  const { editor, tooltip, tippyModal, iframe: targetElement, wrapper, extraActions } = options;
  const nodePos = editor.view.posAtDOM(wrapper, 0);
  const { attrs: mediaNodeAttrs = {} } = editor.state.doc.nodeAt(nodePos) || {};
  const { float, display, margin: mediaMargin } = mediaNodeAttrs;

  clearChildNodes(tippyModal);

  const div = createElement("div", "hypermultimedia__modal");
  const [buttonInline, btnSquareLeft, btnSquareCenter, btnSquareRight] = buttonTypes.map((type) => {
    return createElement("button", "", Icons[type]());
  });

  btnPlacementSettings(mediaMargin, [
    buttonInline,
    btnSquareCenter,
    btnSquareLeft,
    btnSquareRight,
  ]).forEach(({ button, style, attributes }) => {
    button.addEventListener("click", () => {
      return applyStyleAndAttributes(wrapper, style, attributes, editor, tooltip, nodePos);
    });
    button.addEventListener("touchstart", (e) => {
      e.preventDefault();
      return applyStyleAndAttributes(wrapper, style, attributes, editor, tooltip, nodePos);
    });
  });

  highlightButton(float, mediaMargin, display, {
    btnSquareLeft,
    btnSquareRight,
    buttonInline,
    btnSquareCenter,
  });

  const marginDivider = createElement("div", "hypermultimedia__modal__divider");

  const selectMargin = createMarginSelection(nodePos, wrapper, tooltip, editor, mediaMargin);

  selectMargin.style.display = marginDivider.style.display = "none";

  if (["left", "right"].includes(float)) {
    selectMargin.style.display = marginDivider.style.display = "block";
  }

  div.append(
    buttonInline,
    btnSquareCenter,
    btnSquareLeft,
    btnSquareRight,
    marginDivider,
    selectMargin
  );

  tippyModal.append(div);

  if (extraActions) div.append(...extraActions);

  // Update the modal position
  tooltip.update(options.editor.view, { placement: "bottom-start" }, targetElement);
};
