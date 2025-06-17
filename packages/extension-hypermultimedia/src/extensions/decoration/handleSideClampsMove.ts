import { Editor, posToDOMRect } from "@tiptap/core";
import { getTooltipInstance } from "../../utils/utils";

const MIN_WIDTH = 60;
const MIN_HEIGHT = 30;

interface Prob {
  from?: number;
}

export default function resizableClamps(
  clamp: HTMLElement,
  gripper: HTMLElement,
  editor: Editor,
  prob: Prob
): void {
  let initialX = 0;
  let initialY = 0;
  let initialWidth = 0;
  let initialHeight = 0;
  let initialLeft = 0;
  let initialTop = 0;

  function getPointerPosition(e: MouseEvent | TouchEvent): { x: number; y: number } {
    if (e.type.startsWith("touch") && "touches" in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
    const mouseEvent = e as MouseEvent;
    return {
      x: mouseEvent.clientX,
      y: mouseEvent.clientY,
    };
  }

  function handleStart(e: MouseEvent | TouchEvent) {
    e.preventDefault();

    const { x, y } = getPointerPosition(e);

    initialX = x;
    initialY = y;
    initialWidth = gripper.offsetWidth;
    initialHeight = gripper.offsetHeight;
    initialTop = gripper.offsetTop;
    initialLeft = gripper.offsetLeft;

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleMove);
    document.addEventListener("touchend", handleEnd);
  }

  function handleMove(e: MouseEvent | TouchEvent) {
    const { x, y } = getPointerPosition(e);
    const deltaX = x - initialX;
    const deltaY = y - initialY;

    let newWidth: number | undefined;
    let newHeight: number | undefined;

    if (clamp.classList.contains("media-resize-clamp--left")) {
      newWidth = initialWidth - deltaX;
      if (newWidth >= MIN_WIDTH) {
        gripper.style.width = `${newWidth}px`;
        gripper.style.left = `${initialLeft + deltaX}px`;
      }
    } else if (clamp.classList.contains("media-resize-clamp--right")) {
      newWidth = initialWidth + deltaX;
      if (newWidth >= MIN_WIDTH) {
        gripper.style.width = `${newWidth}px`;
      }
    } else if (clamp.classList.contains("media-resize-clamp--top")) {
      newHeight = initialHeight - deltaY;
      if (newHeight >= MIN_HEIGHT) {
        gripper.style.height = `${newHeight}px`;
        gripper.style.top = `${initialTop + deltaY}px`;
      }
    } else if (clamp.classList.contains("media-resize-clamp--bottom")) {
      newHeight = initialHeight + deltaY;
      if (newHeight >= MIN_HEIGHT) {
        gripper.style.height = `${newHeight}px`;
      }
    }

    // destroy the tooltip when the clamp is moved
    const tooltipInstance = getTooltipInstance();
    if (tooltipInstance?.tooltip) tooltipInstance.tooltip.destroyTooltip();
  }

  function handleEnd() {
    document.removeEventListener("mousemove", handleMove);
    document.removeEventListener("mouseup", handleEnd);
    document.removeEventListener("touchmove", handleMove);
    document.removeEventListener("touchend", handleEnd);

    const finalWidth = gripper.offsetWidth;
    const finalHeight = gripper.offsetHeight;

    // Reset the position of the gripper to its initial inline style
    gripper.style.left = `${initialLeft}px`;
    gripper.style.top = `${initialTop}px`;

    const currentNodePos = prob.from ?? null;
    if (currentNodePos !== null) {
      const { state, dispatch } = editor.view;
      const { tr } = state;

      const domAtPos = editor.view.nodeDOM(currentNodePos) as HTMLElement | null;
      if (domAtPos) {
        domAtPos.style.width = `${finalWidth}px`;
        domAtPos.style.height = `${finalHeight}px`;
      }

      const node = state.doc.nodeAt(currentNodePos);
      if (node) {
        tr.setNodeMarkup(currentNodePos, null, {
          ...node.attrs,
          width: finalWidth,
          height: finalHeight,
        });
      }

      tr.setMeta("resizeMedia", true);
      tr.setMeta("addToHistory", true);
      dispatch(tr);
    }
  }

  // Listen for both mouse and touch start events
  clamp.addEventListener("mousedown", handleStart);
  clamp.addEventListener("touchstart", handleStart);
}
