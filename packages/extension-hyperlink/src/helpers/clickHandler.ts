import { getAttributes, Node } from "@tiptap/core";
import { MarkType } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Editor } from "@tiptap/core";
import { EditorView } from "@tiptap/pm/view";
import Tooltip from "./tippyHelper";

// Define type for the ClickHandlerOptions
type ClickHandlerOptions = {
  type: MarkType;
  editor: Editor;
  validate?: (url: string) => boolean;
  view: EditorView;
  modal?: ((options: any) => HTMLElement) | null;
};

const clickAndTouchHandler = (
  event: MouseEvent | TouchEvent,
  options: ClickHandlerOptions,
  tooltip: Tooltip,
  tippyModal: HTMLDivElement,
  pos: number | undefined,
): boolean => {
  // Get the target HTML element and its position
  const nodeTarget: HTMLElement = event.target as HTMLElement;
  const nodePos = options.view.posAtDOM(nodeTarget, 0);

  // Find the closest link element to the target element
  const link = nodeTarget?.closest("a");

  // Extract attributes from the state
  const attrs = getAttributes(options.view.state, options.type.name);

  // Extract href and target attributes from the link element or the state
  const href = link?.href ?? attrs.href;
  const target = link?.target ?? attrs.target;

  // if only event coming from mobile
  const { from, to } = options.view.state.selection;
  const setTextSelectionPos = from === to ? pos : { from, to };
  options.editor
    .chain()
    .focus(pos === 0 ? "start" : pos)
    .setTextSelection(setTextSelectionPos || 0)
    .run();

  // If there is no previewHyperlink modal provided, then open the link in new window
  if (!options.modal) {
    if (link && href) {
      window.open(href, target);
    }
    return true;
  }

  // if the link does not contain href attribute, hide the tooltip
  if (!link?.href) return tooltip.hide();

  event.preventDefault();

  // make sure the editor has focuse on the link and selected
  // if (!options.editor.isEditable)

  // Create a preview of the hyperlink
  const hyperlinkPreview = options.modal({
    link,
    nodePos,
    tippy: tooltip,
    ...options,
  });

  // If there is no hyperlink preview, hide the modal
  if (!hyperlinkPreview) return tooltip.hide();

  // Empty the modal and append the hyperlink preview box

  while (tippyModal.firstChild) {
    tippyModal.removeChild(tippyModal.firstChild);
  }

  tippyModal.append(hyperlinkPreview);

  // Update the modal position
  tooltip.update(options.view);

  return false;
};

export default function clickHandler(options: ClickHandlerOptions): Plugin {
  // Create the tooltip instance
  let tooltip = new Tooltip(options);

  // Initialize the tooltip
  let { tippyModal } = tooltip.init();

  return new Plugin({
    key: new PluginKey("handleClickHyperlink"),
    props: {
      handleDOMEvents: {
        touchend: (view: EditorView, event: TouchEvent) => {
          const { clientX, clientY } = event.changedTouches[0];
          const pos = view.posAtCoords({ left: clientX, top: clientY });

          return clickAndTouchHandler(
            event,
            options,
            tooltip,
            tippyModal,
            pos?.pos,
          );
        },
        click: (view: EditorView, event: MouseEvent) => {
          if (event?.button !== 0) return false;
          const coords = { left: event.clientX, top: event.clientY };
          const pos = view.posAtCoords(coords);

          return clickAndTouchHandler(
            event,
            options,
            tooltip,
            tippyModal,
            pos?.pos,
          );
        },
      },
    },
  });
}
