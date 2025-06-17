import { Editor } from "@tiptap/core";
import { EditorView } from "@tiptap/pm/view";
import { MediaPlacement } from "../../utils/media-placement";
import Tippy from "../../utils/tippyHelper";

// ![alt text](image_url)
// ![alt text](image_url "title")
export const inputRegex = /(?:^|\s)(!\[(.+|:?)]\((\S+)(?:(?:\s+)["'](\S+)["'])?\))$/;

type ImageClickHandlerOptions = {
  editor: Editor;
  tooltip: Tippy;
  tippyModal: HTMLElement;
  modal?: ((options: MediaPlacement) => void) | null;
};

export const imageClickHandler = (
  view: EditorView,
  event: MouseEvent | TouchEvent,
  options: {
    editor: Editor;
    tooltip: Tippy | null;
    tippyModal: HTMLElement | null;
    modal: ((options: MediaPlacement) => void) | null;
  }
) => {
  // when you are in mobile browser mode, the click and touch will fire both,
  // and the click does not have pointerType but for touchstart we will recive "touch" as value
  // @ts-ignore
  if (!event?.pointerType) return true;

  const img = event.target as HTMLImageElement;

  if (img && img.localName === "img") {
    if (options.modal && options.tooltip && options.tippyModal) {
      options.modal({
        editor: options.editor,
        tooltip: options.tooltip,
        tippyModal: options.tippyModal,
        iframe: img,
        wrapper: img,
      });
    }

    const mediaResizeGripper = img.previousSibling as HTMLElement;

    // if mediaresizeGripper does active for image, return
    if (!mediaResizeGripper) return;

    mediaResizeGripper.style.width = `${img.width}px`;
    mediaResizeGripper.style.height = `${img.height}px`;
    mediaResizeGripper.style.left = `${img.offsetLeft}px`;
    mediaResizeGripper.style.top = `${img.offsetTop}px`;
    mediaResizeGripper.classList.add("hypermultimedia__resize-gripper--active");

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      // @ts-ignore
      if (!event.pointerType) return;

      if (event.target !== img) {
        removeResizeBorderAndListener();
      }
    };

    const handleResize = () => {
      removeResizeBorderAndListener();
    };

    const removeResizeBorderAndListener = () => {
      mediaResizeGripper.classList.remove("hypermultimedia__resize-gripper--active");
      options.tooltip?.destroyTooltip();
      options.editor.commands.blur();

      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      window.removeEventListener("resize", handleResize);
    };

    document.addEventListener("click", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("touchend", handleClickOutside);
    window.addEventListener("resize", handleResize);
  }
};
