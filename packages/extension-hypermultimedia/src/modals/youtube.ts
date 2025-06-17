import * as Icons from "../utils/icons";
import { createElement } from "../utils/utils";
import { mediaPlacement, MediaPlacement } from "../utils/media-placement";

export const youtubeModal = ({ editor, tooltip, tippyModal, iframe, wrapper }: any): void => {
  const doesMediaResizeGripperExist = wrapper.previousSibling as HTMLElement;

  const btnResize = createElement("button", "", Icons["Resize"]());
  btnResize.classList.add("hypermultimedia__modal__btn--resize");

  const dvided = createElement("div", "hypermultimedia__modal__divider");

  let documentClickListener: ((event: Event) => void) | null = null;

  function toggleDocumentClickListener() {
    // If the documentClickListener is already defined, remove it and clear the reference
    if (documentClickListener) {
      document.removeEventListener("click", documentClickListener);
      documentClickListener = null;
    } else {
      // Otherwise, define the listener and add it to the document
      documentClickListener = (event) => {
        const mediaResizeGripper = wrapper.previousSibling as HTMLElement;

        if (!mediaResizeGripper && documentClickListener) {
          document.removeEventListener("click", documentClickListener);
          documentClickListener = null;
        }

        if (
          mediaResizeGripper &&
          documentClickListener &&
          !mediaResizeGripper.contains(event.target as Node) &&
          event.target !== mediaResizeGripper
        ) {
          mediaResizeGripper?.classList?.remove("hypermultimedia__resize-gripper--active");
          // Remove the document click listener once it's done its job
          document.removeEventListener("click", documentClickListener);
          documentClickListener = null;
        }
      };

      document.addEventListener("click", documentClickListener);
    }
  }

  btnResize.addEventListener("click", (event) => {
    const mediaResizeGripper = wrapper.previousSibling as HTMLElement;
    if (!mediaResizeGripper) return;

    // hate typescripte 🤬
    // if ("width" in iframe) {
    // @ts-ignore
    mediaResizeGripper.style.width = `${iframe.width || iframe.clientWidth}px`;
    // @ts-ignore
    mediaResizeGripper.style.height = `${iframe.height || iframe.clientHeight}px`;
    // }
    mediaResizeGripper.style.left = `${iframe.offsetLeft}px`;
    mediaResizeGripper.style.top = `${iframe.offsetTop}px`;

    mediaResizeGripper.classList.toggle("hypermultimedia__resize-gripper--active");

    toggleDocumentClickListener();

    event.stopPropagation();
  });

  const extraActions = [];

  if (doesMediaResizeGripperExist) extraActions.push(dvided, btnResize);

  mediaPlacement({ editor, tooltip, tippyModal, iframe, wrapper, extraActions });
};
