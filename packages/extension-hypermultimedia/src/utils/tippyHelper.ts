import tippy, { Instance, Props, roundArrow } from "tippy.js";
import { Editor } from "@tiptap/core";
import { EditorView } from "@tiptap/pm/view";
import { posToDOMRect } from "@tiptap/core";

interface TippyInitOptions {
  editor: Editor;
  targetElement?: string;
}

class Tooltip {
  private tippyInstance?: Instance;
  private preventHide: boolean = false;
  private tippyWrapper: HTMLDivElement;
  private editor: Editor;
  private view: EditorView;
  private targetElement?: string;

  constructor(options: TippyInitOptions) {
    this.editor = options.editor;
    this.view = options.editor.view;
    this.tippyWrapper = document.createElement("div");
    this.tippyWrapper.addEventListener("mousedown", this.mousedownHandler, {
      capture: true,
    });
    this.view.dom.addEventListener("dragstart", this.dragstartHandler);
    this.editor.on("blur", this.blurHandler);
    this.view.dom.addEventListener("resize", this.destroyTooltip);
  }

  init() {
    this.tippyWrapper.innerHTML = "";

    return { tippyModal: this.tippyWrapper, tippyInstance: this.tippyInstance };
  }

  show() {
    setTimeout(() => this.tippyInstance?.show());
    return true;
  }

  hide() {
    setTimeout(() => this.tippyInstance?.hide());
    return false;
  }

  private mousedownHandler = () => {
    this.preventHide = true;
  };

  private dragstartHandler = () => {
    this.hide();
  };

  private blurHandler = ({ event }: { event: FocusEvent }) => {
    if (this.preventHide) {
      this.preventHide = false;
      return;
    }
    if (
      event?.relatedTarget &&
      this.tippyWrapper.parentNode?.contains(event.relatedTarget as Node)
    ) {
      return;
    }
    this.hide();
  };

  private tippyBlurHandler = (event: FocusEvent) => {
    this.blurHandler({ event });
  };

  private createTooltip() {
    if (!this.editor || !this.editor.options) return;
    const { element: editorElement } = this.editor.options;
    const editorIsAttached = !!editorElement.parentElement;

    if (this.tippyInstance || !editorIsAttached) {
      return;
    }

    let element = this.targetElement ? document.querySelector(this.targetElement) : editorElement;

    if (!element) element = editorElement;

    if (!element) {
      throw new Error("No element found for Tooltip");
    }
    this.tippyInstance = tippy(element, {
      duration: 0,
      getReferenceClientRect: null,
      content: this.tippyWrapper,
      interactive: true,
      trigger: "manual",
      placement: "bottom",
      hideOnClick: true,
      maxWidth: "none",
      onClickOutside: (instance, event) => {
        this.hide();
      },
      onBeforeUpdate: (instance, partialProps) => {
        this.show();
      },
      onAfterUpdate: (instance, partialProps) => {
        this.show();
      },
    });

    if (this.tippyInstance.popper.firstChild) {
      (this.tippyInstance.popper.firstChild as HTMLElement).addEventListener(
        "blur",
        this.tippyBlurHandler
      );
    }
  }
  update(view: EditorView, option: any = {}, targetElement: HTMLElement | null = null): void {
    this.createTooltip();

    option.arrow = option?.arrow ?? false;

    if (this.tippyInstance) {
      this.tippyInstance.setProps({
        ...option,
        getReferenceClientRect: () => {
          const pos = view.state.selection.from;
          let nodePos;
          if (targetElement) {
            const rect = targetElement.getBoundingClientRect();
            nodePos = {
              width: rect.width,
              height: rect.height,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
            };
          }

          // width: 0 is a hack to prevent tippy display in the wrong position
          return nodePos ? nodePos : { ...posToDOMRect(view, pos, pos), width: 0 };
        },
      });
    }
  }

  destroyTooltip() {
    if (this.tippyInstance) {
      this.tippyInstance.destroy();
      this.tippyInstance = undefined;
      this.tippyWrapper.removeEventListener("mousedown", this.mousedownHandler, {
        capture: true,
      });
      this.view.dom.removeEventListener("dragstart", this.dragstartHandler);
      this.editor.off("blur", this.blurHandler);
    }
  }
}

export default Tooltip;
