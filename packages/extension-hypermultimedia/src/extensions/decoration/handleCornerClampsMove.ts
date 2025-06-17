import { Editor } from "@tiptap/core";
import { getTooltipInstance } from "../../utils/utils";

const MIN_WIDTH = 60;
const MIN_HEIGHT = 30;

type Corner = "topRight" | "bottomLeft" | "topLeft" | "bottomRight";

interface Prob {
  from?: number;
}

export default function resizable(
  clamp: HTMLElement,
  corner: Corner,
  gripper: HTMLElement,
  editor: Editor,
  prob: Prob
): void {
  let initialLeft = 0;
  let initialTop = 0;

  function getPointerPosition(e: MouseEvent | TouchEvent): { x: number; y: number } {
    if (e.type.startsWith("touch") && "touches" in e && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    const mouseEvent = e as MouseEvent;
    return { x: mouseEvent.clientX, y: mouseEvent.clientY };
  }

  function handleDown(selectedCorner: Corner) {
    return function (e: MouseEvent | TouchEvent) {
      e.preventDefault();

      const { x, y } = getPointerPosition(e);

      const initial = {
        x,
        y,
        width: gripper.offsetWidth,
        height: gripper.offsetHeight,
        top: gripper.offsetTop,
        left: gripper.offsetLeft,
      };

      function handleMove(ev: MouseEvent | TouchEvent) {
        const { x: moveX, y: moveY } = getPointerPosition(ev);
        const deltaX = moveX - initial.x;
        const deltaY = moveY - initial.y;

        let newWidth: number;
        let newHeight: number;

        switch (selectedCorner) {
          case "topRight":
            newWidth = initial.width + deltaX;
            newHeight = initial.height - deltaY;
            if (newWidth >= MIN_WIDTH && newHeight >= MIN_HEIGHT) {
              gripper.style.width = `${newWidth}px`;
              gripper.style.height = `${newHeight}px`;
              gripper.style.top = `${initial.top + deltaY}px`;
            }
            break;
          case "bottomLeft":
            newWidth = initial.width - deltaX;
            newHeight = initial.height + deltaY;
            if (newWidth >= MIN_WIDTH && newHeight >= MIN_HEIGHT) {
              gripper.style.width = `${newWidth}px`;
              gripper.style.height = `${newHeight}px`;
              gripper.style.left = `${initial.left + deltaX}px`;
            }
            break;
          case "topLeft":
            newWidth = initial.width - deltaX;
            newHeight = initial.height - deltaY;
            if (newWidth >= MIN_WIDTH && newHeight >= MIN_HEIGHT) {
              gripper.style.width = `${newWidth}px`;
              gripper.style.height = `${newHeight}px`;
              gripper.style.top = `${initial.top + deltaY}px`;
              gripper.style.left = `${initial.left + deltaX}px`;
            }
            break;
          case "bottomRight":
            newWidth = initial.width + deltaX;
            newHeight = initial.height + deltaY;
            if (newWidth >= MIN_WIDTH && newHeight >= MIN_HEIGHT) {
              gripper.style.width = `${newWidth}px`;
              gripper.style.height = `${newHeight}px`;
            }
            break;
        }
      }

      function handleUp() {
        handleMouseUpCorner();
        const tooltipInstance = getTooltipInstance();
        if (tooltipInstance?.tooltip) tooltipInstance.tooltip.destroyTooltip();
        editor.commands.blur();

        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleUp);
        document.removeEventListener("touchmove", handleMove);
        document.removeEventListener("touchend", handleUp);
      }

      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleUp);
      document.addEventListener("touchmove", handleMove);
      document.addEventListener("touchend", handleUp);
    };
  }

  function handleMouseUpCorner() {
    const finalWidth = gripper.offsetWidth;
    const finalHeight = gripper.offsetHeight;

    // Reset inline top/left styles
    gripper.style.left = `${initialLeft}px`;
    gripper.style.top = `${initialTop}px`;

    const currentNodePos = prob.from ?? null;
    if (currentNodePos !== null) {
      const { state, dispatch } = editor.view;
      const { tr } = state;

      const domAtPos = editor.view.nodeDOM(currentNodePos) as HTMLElement;
      if (domAtPos) {
        domAtPos.style.width = `${finalWidth}px`;
        domAtPos.style.height = `${finalHeight}px`;
      }

      const nodeAtPos = state.doc.nodeAt(currentNodePos);
      if (nodeAtPos) {
        tr.setNodeMarkup(currentNodePos, null, {
          ...nodeAtPos.attrs,
          width: finalWidth,
          height: finalHeight,
        });
      }

      tr.setMeta("resizeMedia", true);
      tr.setMeta("addToHistory", true);
      dispatch(tr);
    }
  }

  clamp.addEventListener("mousedown", handleDown(corner));
  clamp.addEventListener("touchstart", handleDown(corner));
}
