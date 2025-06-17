import { mediaPlacement, MediaPlacement } from "../utils/media-placement";

export const twitterModal = ({
  editor,
  tooltip,
  tippyModal,
  iframe,
  wrapper,
}: MediaPlacement): void => {
  mediaPlacement({ editor, tooltip, tippyModal, iframe, wrapper });
};
